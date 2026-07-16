#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const databasePath = new URL('./tattoo_database.json', import.meta.url);
const archivePath = new URL('./alexy.zip', import.meta.url);
const outputPath = new URL('./t1000.sql', import.meta.url);

const databaseBuffer = fs.readFileSync(databasePath);
const archiveBuffer = fs.readFileSync(archivePath);
const database = JSON.parse(databaseBuffer.toString('utf8'));

const alexyFiles = [
  ['alexy/00_README.md', 'overview'],
  ['alexy/01_PERSONA.json', 'persona'],
  ['alexy/02_KNOWLEDGE_BASE.json', 'knowledge_base'],
  ['alexy/03_SYSTEM_PROMPT.md', 'system_prompt'],
  ['alexy/04_IMAGE_PROMPT_TEMPLATE.md', 'image_prompt_template'],
  ['alexy/05_EXAMPLE_end_to_end.md', 'example'],
].map(([archiveName, role]) => {
  const content = execFileSync('unzip', ['-p', archivePath.pathname, archiveName], {
    encoding: 'utf8',
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    archiveName,
    name: archiveName.replace(/^alexy\//, ''),
    role,
    mediaType: archiveName.endsWith('.json') ? 'application/json' : 'text/markdown',
    content,
    sha256: sha256(Buffer.from(content, 'utf8')),
  };
});

const personaDocument = alexyFiles.find((file) => file.role === 'persona');
const knowledgeDocument = alexyFiles.find((file) => file.role === 'knowledge_base');
const persona = JSON.parse(personaDocument.content);
const knowledgeBase = JSON.parse(knowledgeDocument.content);

validateSource();

const styleCategoryById = new Map(database.styleCategories.map((item) => [item.id, item]));
const techniqueCategoryById = new Map(database.techniqueCategories.map((item) => [item.id, item]));
const styleById = new Map(database.styles.map((item) => [item.id, item]));
const techniqueById = new Map(database.techniques.map((item) => [item.id, item]));

const sql = [];
sql.push(`-- InkTelligence / Alexei "Inkseer" Novak
-- Generated from tattoo_database.json and alexy.zip by generate_t1000_sql.mjs.
-- Target: MariaDB 10.11+ / MySQL 8.0+
-- The import is non-destructive at database level and can be executed repeatedly.

SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;
SET @OLD_FOREIGN_KEY_CHECKS = @@FOREIGN_KEY_CHECKS;
SET FOREIGN_KEY_CHECKS = 0;

CREATE DATABASE IF NOT EXISTS \`t1000\`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE \`t1000\`;

CREATE TABLE IF NOT EXISTS import_manifest (
  manifest_id TINYINT UNSIGNED NOT NULL,
  source_name VARCHAR(190) NOT NULL,
  source_version VARCHAR(32) NOT NULL,
  source_date DATE NULL,
  source_language VARCHAR(16) NOT NULL,
  tattoo_database_sha256 CHAR(64) NOT NULL,
  alexy_package_sha256 CHAR(64) NOT NULL,
  source_meta JSON NOT NULL,
  source_counts JSON NOT NULL,
  imported_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (manifest_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS style_categories (
  category_id VARCHAR(100) NOT NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT NOT NULL,
  source_payload JSON NOT NULL,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_style_category_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS technique_categories (
  category_id VARCHAR(100) NOT NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT NOT NULL,
  source_payload JSON NOT NULL,
  PRIMARY KEY (category_id),
  UNIQUE KEY uq_technique_category_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS styles (
  style_id VARCHAR(100) NOT NULL,
  category_id VARCHAR(100) NOT NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT NOT NULL,
  history TEXT NOT NULL,
  distinct_features TEXT NOT NULL,
  narrative_description LONGTEXT NOT NULL,
  narrative_language VARCHAR(16) NOT NULL DEFAULT 'en',
  source_payload JSON NOT NULL,
  PRIMARY KEY (style_id),
  UNIQUE KEY uq_style_name (name),
  KEY ix_styles_category (category_id),
  FULLTEXT KEY ft_styles_compendium (name, description, history, distinct_features, narrative_description),
  CONSTRAINT fk_styles_category FOREIGN KEY (category_id)
    REFERENCES style_categories (category_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS techniques (
  technique_id VARCHAR(100) NOT NULL,
  category_id VARCHAR(100) NOT NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT NOT NULL,
  difficulty ENUM('basic', 'beginner', 'intermediate', 'advanced', 'expert', 'unspecified') NOT NULL DEFAULT 'unspecified',
  narrative_description LONGTEXT NOT NULL,
  narrative_language VARCHAR(16) NOT NULL DEFAULT 'en',
  source_payload JSON NOT NULL,
  PRIMARY KEY (technique_id),
  UNIQUE KEY uq_technique_name (name),
  KEY ix_techniques_category (category_id),
  KEY ix_techniques_difficulty (difficulty),
  FULLTEXT KEY ft_techniques_compendium (name, description, narrative_description),
  CONSTRAINT fk_techniques_category FOREIGN KEY (category_id)
    REFERENCES technique_categories (category_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS style_motifs (
  style_id VARCHAR(100) NOT NULL,
  motif VARCHAR(190) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (style_id, motif),
  KEY ix_style_motifs_motif (motif),
  CONSTRAINT fk_style_motifs_style FOREIGN KEY (style_id)
    REFERENCES styles (style_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS style_techniques (
  style_id VARCHAR(100) NOT NULL,
  technique_id VARCHAR(100) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  relation_source ENUM('style.relatedTechniques', 'inferred') NOT NULL DEFAULT 'style.relatedTechniques',
  PRIMARY KEY (style_id, technique_id),
  KEY ix_style_techniques_technique (technique_id),
  CONSTRAINT fk_style_techniques_style FOREIGN KEY (style_id)
    REFERENCES styles (style_id) ON DELETE CASCADE,
  CONSTRAINT fk_style_techniques_technique FOREIGN KEY (technique_id)
    REFERENCES techniques (technique_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS related_styles (
  style_id VARCHAR(100) NOT NULL,
  related_style_id VARCHAR(100) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (style_id, related_style_id),
  KEY ix_related_styles_target (related_style_id),
  CONSTRAINT fk_related_styles_style FOREIGN KEY (style_id)
    REFERENCES styles (style_id) ON DELETE CASCADE,
  CONSTRAINT fk_related_styles_target FOREIGN KEY (related_style_id)
    REFERENCES styles (style_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS technique_style_usage (
  technique_id VARCHAR(100) NOT NULL,
  style_id VARCHAR(100) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (technique_id, style_id),
  KEY ix_technique_usage_style (style_id),
  CONSTRAINT fk_technique_usage_technique FOREIGN KEY (technique_id)
    REFERENCES techniques (technique_id) ON DELETE CASCADE,
  CONSTRAINT fk_technique_usage_style FOREIGN KEY (style_id)
    REFERENCES styles (style_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mixed_styles (
  mixed_style_id VARCHAR(100) NOT NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT NOT NULL,
  narrative_description LONGTEXT NOT NULL,
  narrative_language VARCHAR(16) NOT NULL DEFAULT 'en',
  PRIMARY KEY (mixed_style_id),
  UNIQUE KEY uq_mixed_style_name (name),
  FULLTEXT KEY ft_mixed_styles (name, description, narrative_description)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mixed_style_components (
  mixed_style_id VARCHAR(100) NOT NULL,
  component_order SMALLINT UNSIGNED NOT NULL,
  component_id VARCHAR(100) NOT NULL,
  component_type ENUM('style', 'technique', 'unknown') NOT NULL,
  PRIMARY KEY (mixed_style_id, component_order),
  KEY ix_mixed_components_component (component_id),
  CONSTRAINT fk_mixed_components_mixed_style FOREIGN KEY (mixed_style_id)
    REFERENCES mixed_styles (mixed_style_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_personas (
  persona_id VARCHAR(100) NOT NULL,
  schema_version VARCHAR(32) NOT NULL,
  persona_type VARCHAR(100) NOT NULL,
  display_name VARCHAR(190) NOT NULL,
  description TEXT NOT NULL,
  payload JSON NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  PRIMARY KEY (persona_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_knowledge_bases (
  knowledge_base_id VARCHAR(100) NOT NULL,
  schema_version VARCHAR(32) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  payload JSON NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  PRIMARY KEY (knowledge_base_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_documents (
  document_name VARCHAR(190) NOT NULL,
  document_role ENUM('overview', 'persona', 'knowledge_base', 'system_prompt', 'image_prompt_template', 'example') NOT NULL,
  media_type VARCHAR(100) NOT NULL,
  content LONGTEXT NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  PRIMARY KEY (document_name),
  KEY ix_ai_documents_role (document_role),
  FULLTEXT KEY ft_ai_documents_content (content)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_packages (
  package_id VARCHAR(100) NOT NULL,
  file_name VARCHAR(190) NOT NULL,
  media_type VARCHAR(100) NOT NULL,
  archive_blob LONGBLOB NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  PRIMARY KEY (package_id),
  UNIQUE KEY uq_ai_package_file_name (file_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ai_agents (
  agent_id VARCHAR(100) NOT NULL,
  persona_id VARCHAR(100) NOT NULL,
  knowledge_base_id VARCHAR(100) NOT NULL,
  display_name VARCHAR(190) NOT NULL,
  default_language VARCHAR(16) NOT NULL DEFAULT 'pl',
  system_prompt_document VARCHAR(190) NOT NULL,
  image_prompt_document VARCHAR(190) NOT NULL,
  example_document VARCHAR(190) NOT NULL,
  runtime_config JSON NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (agent_id),
  CONSTRAINT fk_ai_agents_persona FOREIGN KEY (persona_id)
    REFERENCES ai_personas (persona_id),
  CONSTRAINT fk_ai_agents_knowledge FOREIGN KEY (knowledge_base_id)
    REFERENCES ai_knowledge_bases (knowledge_base_id),
  CONSTRAINT fk_ai_agents_system_prompt FOREIGN KEY (system_prompt_document)
    REFERENCES ai_documents (document_name),
  CONSTRAINT fk_ai_agents_image_prompt FOREIGN KEY (image_prompt_document)
    REFERENCES ai_documents (document_name),
  CONSTRAINT fk_ai_agents_example FOREIGN KEY (example_document)
    REFERENCES ai_documents (document_name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS consultation_sessions (
  session_id CHAR(36) NOT NULL,
  agent_id VARCHAR(100) NOT NULL DEFAULT 'alexei_inkseer',
  language_code VARCHAR(16) NOT NULL DEFAULT 'pl',
  client_name VARCHAR(190) NULL,
  current_phase TINYINT UNSIGNED NOT NULL DEFAULT 1,
  status ENUM('active', 'completed', 'archived') NOT NULL DEFAULT 'active',
  context_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id),
  KEY ix_sessions_agent_status (agent_id, status),
  CONSTRAINT chk_sessions_phase CHECK (current_phase BETWEEN 1 AND 6),
  CONSTRAINT fk_sessions_agent FOREIGN KEY (agent_id)
    REFERENCES ai_agents (agent_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS consultation_messages (
  message_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id CHAR(36) NOT NULL,
  role ENUM('system', 'user', 'assistant', 'tool') NOT NULL,
  content LONGTEXT NOT NULL,
  structured_payload JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id),
  KEY ix_messages_session_time (session_id, created_at),
  CONSTRAINT fk_messages_session FOREIGN KEY (session_id)
    REFERENCES consultation_sessions (session_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS generated_designs (
  design_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id CHAR(36) NOT NULL,
  design_spec JSON NOT NULL,
  image_prompt LONGTEXT NOT NULL,
  target_generator VARCHAR(100) NULL,
  studio_brief LONGTEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (design_id),
  KEY ix_designs_session (session_id),
  CONSTRAINT fk_designs_session FOREIGN KEY (session_id)
    REFERENCES consultation_sessions (session_id) ON DELETE CASCADE
) ENGINE=InnoDB;
`);

sql.push(upsert('import_manifest', [
  'manifest_id', 'source_name', 'source_version', 'source_date', 'source_language',
  'tattoo_database_sha256', 'alexy_package_sha256', 'source_meta', 'source_counts',
], [[
  1,
  database.meta.name,
  database.meta.version,
  database.meta.date,
  database.meta.language,
  sha256(databaseBuffer),
  sha256(archiveBuffer),
  json(database.meta),
  json({
    ...database.meta.counts,
    mixedStyles: database.mixedStyles.examples.length,
    alexyDocuments: alexyFiles.length,
  }),
]], ['source_name', 'source_version', 'source_date', 'source_language', 'tattoo_database_sha256', 'alexy_package_sha256', 'source_meta', 'source_counts']));

sql.push(upsert('style_categories', ['category_id', 'name', 'description', 'source_payload'],
  database.styleCategories.map((item) => [item.id, item.name, item.description, json(item)]),
  ['name', 'description', 'source_payload']));

sql.push(upsert('technique_categories', ['category_id', 'name', 'description', 'source_payload'],
  database.techniqueCategories.map((item) => [item.id, item.name, item.description, json(item)]),
  ['name', 'description', 'source_payload']));

sql.push(upsert('styles', [
  'style_id', 'category_id', 'name', 'description', 'history', 'distinct_features',
  'narrative_description', 'narrative_language', 'source_payload',
], database.styles.map((item) => [
  item.id,
  item.category,
  item.name,
  item.description,
  item.history,
  item.distinctFeatures,
  styleNarrative(item),
  database.meta.language,
  json(item),
]), ['category_id', 'name', 'description', 'history', 'distinct_features', 'narrative_description', 'narrative_language', 'source_payload']));

sql.push(upsert('techniques', [
  'technique_id', 'category_id', 'name', 'description', 'difficulty',
  'narrative_description', 'narrative_language', 'source_payload',
], database.techniques.map((item) => [
  item.id,
  item.category,
  item.name,
  item.description,
  item.difficulty || 'unspecified',
  techniqueNarrative(item),
  database.meta.language,
  json(item),
]), ['category_id', 'name', 'description', 'difficulty', 'narrative_description', 'narrative_language', 'source_payload']));

sql.push(insertIgnore('style_motifs', ['style_id', 'motif', 'display_order'],
  database.styles.flatMap((item) => item.commonMotifs.map((motif, index) => [item.id, motif, index + 1]))));

sql.push(insertIgnore('style_techniques', ['style_id', 'technique_id', 'display_order', 'relation_source'],
  database.styles.flatMap((item) => item.relatedTechniques.map((techniqueId, index) => [
    item.id, techniqueId, index + 1, 'style.relatedTechniques',
  ]))));

sql.push(insertIgnore('related_styles', ['style_id', 'related_style_id', 'display_order'],
  database.styles.flatMap((item) => item.relatedStyles.map((relatedId, index) => [item.id, relatedId, index + 1]))));

sql.push(insertIgnore('technique_style_usage', ['technique_id', 'style_id', 'display_order'],
  database.techniques.flatMap((item) => item.usedInStyles.map((styleId, index) => [item.id, styleId, index + 1]))));

const mixedStyles = database.mixedStyles.examples.map((item) => ({
  ...item,
  id: slug(item.name),
  description: database.mixedStyles.description,
}));

sql.push(upsert('mixed_styles', [
  'mixed_style_id', 'name', 'description', 'narrative_description', 'narrative_language',
], mixedStyles.map((item) => [
  item.id,
  item.name,
  item.description,
  mixedStyleNarrative(item),
  database.meta.language,
]), ['name', 'description', 'narrative_description', 'narrative_language']));

sql.push(insertIgnore('mixed_style_components', [
  'mixed_style_id', 'component_order', 'component_id', 'component_type',
], mixedStyles.flatMap((item) => item.combination.map((componentId, index) => [
  item.id,
  index + 1,
  componentId,
  styleById.has(componentId) ? 'style' : techniqueById.has(componentId) ? 'technique' : 'unknown',
]))));

sql.push(upsert('ai_personas', [
  'persona_id', 'schema_version', 'persona_type', 'display_name', 'description', 'payload', 'source_sha256',
], [[
  persona.persona_id,
  persona.schema_version,
  persona.persona_type,
  persona.identity.artist_name,
  persona.description,
  json(persona),
  personaDocument.sha256,
]], ['schema_version', 'persona_type', 'display_name', 'description', 'payload', 'source_sha256']));

sql.push(upsert('ai_knowledge_bases', [
  'knowledge_base_id', 'schema_version', 'title', 'description', 'payload', 'source_sha256',
], [[
  'alexei_tattoo_master_kb',
  knowledgeBase.schema_version,
  knowledgeBase.title,
  knowledgeBase.description,
  json(knowledgeBase),
  knowledgeDocument.sha256,
]], ['schema_version', 'title', 'description', 'payload', 'source_sha256']));

sql.push(upsert('ai_documents', [
  'document_name', 'document_role', 'media_type', 'content', 'source_sha256',
], alexyFiles.map((file) => [file.name, file.role, file.mediaType, file.content, file.sha256]),
['document_role', 'media_type', 'content', 'source_sha256']));

sql.push(`INSERT INTO ai_packages
  (package_id, file_name, media_type, archive_blob, source_sha256)
VALUES
  ('alexy_complete_package', 'alexy.zip', 'application/zip', FROM_BASE64(${quote(archiveBuffer.toString('base64'))}), ${quote(sha256(archiveBuffer))})
ON DUPLICATE KEY UPDATE
  file_name = VALUES(file_name),
  media_type = VALUES(media_type),
  archive_blob = VALUES(archive_blob),
  source_sha256 = VALUES(source_sha256);
`);

sql.push(upsert('ai_agents', [
  'agent_id', 'persona_id', 'knowledge_base_id', 'display_name', 'default_language',
  'system_prompt_document', 'image_prompt_document', 'example_document', 'runtime_config', 'is_active',
], [[
  'alexei_inkseer',
  persona.persona_id,
  'alexei_tattoo_master_kb',
  persona.identity.artist_name,
  'pl',
  '03_SYSTEM_PROMPT.md',
  '04_IMAGE_PROMPT_TEMPLATE.md',
  '05_EXAMPLE_end_to_end.md',
  json({
    respond_in_client_language: true,
    consultation_phases: persona.consultation_flow.length,
    ai_parameters: persona.ai_parameters,
    guardrails: persona.guardrails,
    compendium_database: 't1000',
  }),
  1,
]], ['persona_id', 'knowledge_base_id', 'display_name', 'default_language', 'system_prompt_document', 'image_prompt_document', 'example_document', 'runtime_config', 'is_active']));

sql.push(`CREATE OR REPLACE VIEW v_compendium_styles AS
SELECT
  s.style_id,
  s.name,
  c.category_id,
  c.name AS category_name,
  s.description,
  s.history,
  s.distinct_features,
  s.narrative_description,
  s.narrative_language
FROM styles AS s
JOIN style_categories AS c ON c.category_id = s.category_id;

CREATE OR REPLACE VIEW v_compendium_techniques AS
SELECT
  t.technique_id,
  t.name,
  c.category_id,
  c.name AS category_name,
  t.description,
  t.difficulty,
  t.narrative_description,
  t.narrative_language
FROM techniques AS t
JOIN technique_categories AS c ON c.category_id = t.category_id;

CREATE OR REPLACE VIEW v_alexei_runtime_bundle AS
SELECT
  a.agent_id,
  a.display_name,
  a.default_language,
  p.payload AS persona,
  kb.payload AS knowledge_base,
  system_prompt.content AS system_prompt,
  image_prompt.content AS image_prompt_template,
  example_doc.content AS end_to_end_example,
  a.runtime_config
FROM ai_agents AS a
JOIN ai_personas AS p ON p.persona_id = a.persona_id
JOIN ai_knowledge_bases AS kb ON kb.knowledge_base_id = a.knowledge_base_id
JOIN ai_documents AS system_prompt ON system_prompt.document_name = a.system_prompt_document
JOIN ai_documents AS image_prompt ON image_prompt.document_name = a.image_prompt_document
JOIN ai_documents AS example_doc ON example_doc.document_name = a.example_document
WHERE a.is_active = TRUE;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- Verification queries (optional):
-- SELECT * FROM import_manifest;
-- SELECT COUNT(*) FROM styles;            -- 66
-- SELECT COUNT(*) FROM techniques;        -- 44
-- SELECT COUNT(*) FROM mixed_styles;      -- 6
-- SELECT agent_id, display_name FROM v_alexei_runtime_bundle;
`);

fs.writeFileSync(outputPath, sql.join('\n'), 'utf8');

function styleNarrative(item) {
  const category = styleCategoryById.get(item.category);
  const techniques = item.relatedTechniques.map((id) => techniqueById.get(id)?.name || id);
  const related = item.relatedStyles.map((id) => styleById.get(id)?.name || id);
  const parts = [
    `${item.name} belongs to the ${category.name} family. ${item.description}`,
    `Its story begins here: ${item.history}`,
    `On skin, it is recognized by ${lowerFirst(item.distinctFeatures)}`,
  ];
  if (item.commonMotifs.length) parts.push(`Its visual vocabulary often includes ${naturalList(item.commonMotifs)}.`);
  if (techniques.length) parts.push(`The craft is commonly built with ${naturalList(techniques)}.`);
  if (related.length) parts.push(`For a broader design conversation, compare it with ${naturalList(related)}.`);
  return parts.join(' ');
}

function techniqueNarrative(item) {
  const category = techniqueCategoryById.get(item.category);
  const styles = item.usedInStyles.map((id) => styleById.get(id)?.name || id);
  const level = item.difficulty || 'unspecified';
  const parts = [
    `${item.name} is ${indefiniteArticle(level)} ${level}-level method within ${category.name}. ${item.description}`,
    `In practice, it shapes the way ink, line and skin meet rather than defining the subject by itself.`,
  ];
  if (styles.length) parts.push(`It is especially at home in ${naturalList(styles)}.`);
  parts.push(`Its success depends on deliberate execution, anatomical placement and enough spacing for the tattoo to age clearly.`);
  return parts.join(' ');
}

function mixedStyleNarrative(item) {
  const names = item.combination.map((id) => styleById.get(id)?.name || techniqueById.get(id)?.name || id);
  return `${item.name} is a deliberate fusion of ${naturalList(names)}. It works by preserving the recognizable voice of each component while letting contrast, rhythm and composition bind them into one tattoo. The final design should be planned as a single piece rather than two styles placed side by side.`;
}

function validateSource() {
  const expected = database.meta.counts;
  const checks = [
    ['style categories', database.styleCategories.length, expected.styleCategories],
    ['styles', database.styles.length, expected.styles],
    ['technique categories', database.techniqueCategories.length, expected.techniqueCategories],
    ['techniques', database.techniques.length, expected.techniques],
  ];
  for (const [label, actual, declared] of checks) {
    if (actual !== declared) throw new Error(`Invalid ${label} count: declared ${declared}, found ${actual}`);
  }

  assertUnique(database.styleCategories, 'style category');
  assertUnique(database.techniqueCategories, 'technique category');
  assertUnique(database.styles, 'style');
  assertUnique(database.techniques, 'technique');

  const styleIds = new Set(database.styles.map((item) => item.id));
  const techniqueIds = new Set(database.techniques.map((item) => item.id));
  const styleCategoryIds = new Set(database.styleCategories.map((item) => item.id));
  const techniqueCategoryIds = new Set(database.techniqueCategories.map((item) => item.id));

  for (const style of database.styles) {
    if (!styleCategoryIds.has(style.category)) throw new Error(`Unknown category ${style.category} in style ${style.id}`);
    for (const id of style.relatedStyles) if (!styleIds.has(id)) throw new Error(`Unknown related style ${id}`);
    for (const id of style.relatedTechniques) if (!techniqueIds.has(id)) throw new Error(`Unknown related technique ${id}`);
  }
  for (const technique of database.techniques) {
    if (!techniqueCategoryIds.has(technique.category)) throw new Error(`Unknown category ${technique.category} in technique ${technique.id}`);
    for (const id of technique.usedInStyles) if (!styleIds.has(id)) throw new Error(`Unknown used-in style ${id}`);
  }
}

function assertUnique(items, label) {
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate ${label} id: ${item.id}`);
    ids.add(item.id);
  }
}

function upsert(table, columns, rows, updateColumns) {
  if (!rows.length) return '';
  return `INSERT INTO ${identifier(table)} (${columns.map(identifier).join(', ')})\nVALUES\n${rows.map(rowSql).join(',\n')}\nON DUPLICATE KEY UPDATE\n${updateColumns.map((column) => `  ${identifier(column)} = VALUES(${identifier(column)})`).join(',\n')};\n`;
}

function insertIgnore(table, columns, rows) {
  if (!rows.length) return '';
  return `INSERT IGNORE INTO ${identifier(table)} (${columns.map(identifier).join(', ')})\nVALUES\n${rows.map(rowSql).join(',\n')};\n`;
}

function rowSql(row) {
  return `  (${row.map(valueSql).join(', ')})`;
}

function valueSql(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return quote(value);
}

function quote(value) {
  return `'${String(value).replaceAll('\\', '\\\\').replaceAll("'", "''").replaceAll('\0', '\\0')}'`;
}

function identifier(value) {
  return `\`${String(value).replaceAll('`', '``')}\``;
}

function json(value) {
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function slug(value) {
  return value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function naturalList(items) {
  if (items.length < 2) return items[0] || '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items.at(-1)}`;
}

function lowerFirst(value) {
  return value ? value[0].toLowerCase() + value.slice(1) : value;
}

function indefiniteArticle(value) {
  return /^[aeiou]/i.test(value) ? 'an' : 'a';
}
