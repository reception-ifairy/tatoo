#!/usr/bin/env node

import fs from 'node:fs';
import crypto from 'node:crypto';

const databasePath = new URL('./tattoo_database.backup.json', import.meta.url);
const archivePath = new URL('../../alexy.zip', import.meta.url);
const alexyDirectory = new URL('../../data/alexy/', import.meta.url);
const libraryDirectory = new URL('../../data/library/', import.meta.url);
const outputPath = new URL('./t1000.sql', import.meta.url);

// Evidence labels defined by docs/research/RESEARCH_CORPUS_PLAN.md.
const EVIDENCE_LABELS = new Set(['direct', 'synthesized', 'community_attested', 'contested', 'hypothesis', 'unknown']);

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
  const name = archiveName.replace(/^alexy\//, '');
  const content = fs.readFileSync(new URL(name, alexyDirectory), 'utf8');
  return {
    archiveName,
    name,
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

// The research corpus: each paper is mirrored into SQL as a readable library article.
const libraryArticles = database.articles.map((article) => {
  const body = fs.readFileSync(new URL(article.file, libraryDirectory), 'utf8');
  return { ...article, body, sha256: sha256(Buffer.from(body, 'utf8')) };
});

const styleCategoryById = new Map(database.styleCategories.map((item) => [item.id, item]));
const techniqueCategoryById = new Map(database.techniqueCategories.map((item) => [item.id, item]));
const styleById = new Map(database.styles.map((item) => [item.id, item]));
const techniqueById = new Map(database.techniques.map((item) => [item.id, item]));

// Slot vocabulary shared by every renderer. Tag models assemble these in order;
// prose models fill the same names into their templates.
const SLOT_ORDER = ['subject', 'style', 'technique', 'palette', 'composition', 'surface', 'lighting', 'detail'];

const IMAGE_MODELS = [
  {
    model_key: 'sdxl_base',
    family: 'stable_diffusion',
    vendor: 'Stability AI',
    display_name: 'Stable Diffusion XL',
    model_version: '1.0',
    status: 'active',
    is_default: true,
    display_order: 10,
    notes: 'The reference target. Tag-weighted positives, a real negative prompt, and explicit sampler settings.',
    syntax_profile: {
      form: 'tags',
      joiner: ', ',
      slot_order: SLOT_ORDER,
      style_suffix: ' tattoo',
      weights: { syntax: 'sd_parens', emphasis: 1.2, slots: ['style', 'technique'] },
      negative: { mode: 'field', joiner: ', ' },
      parameters: { mode: 'fields' },
      aspect: { mode: 'dimensions', base: 1024 },
    },
    capabilities: {
      supports_negative_prompt: true,
      supports_weights: true,
      supports_parameters: true,
      supports_conversational_edit: false,
      supports_reference_image: true,
      max_prompt_chars: 1500,
    },
    default_parameters: { steps: 34, cfg_scale: 6, sampler: 'DPM++ 2M Karras', clip_skip: 2 },
  },
  {
    model_key: 'sd35_large',
    family: 'stable_diffusion',
    vendor: 'Stability AI',
    display_name: 'Stable Diffusion 3.5 Large',
    model_version: '3.5',
    status: 'active',
    is_default: false,
    display_order: 20,
    notes: 'Follows longer, better-punctuated phrasing than SDXL while still honouring a negative prompt.',
    syntax_profile: {
      form: 'hybrid',
      joiner: ', ',
      slot_order: SLOT_ORDER,
      style_suffix: ' tattoo',
      weights: { syntax: 'sd_parens', emphasis: 1.1, slots: ['style'] },
      negative: { mode: 'field', joiner: ', ' },
      parameters: { mode: 'fields' },
      aspect: { mode: 'dimensions', base: 1024 },
    },
    capabilities: {
      supports_negative_prompt: true,
      supports_weights: true,
      supports_parameters: true,
      supports_conversational_edit: false,
      supports_reference_image: true,
      max_prompt_chars: 2000,
    },
    default_parameters: { steps: 28, cfg_scale: 4.5, sampler: 'DPM++ 2M', shift: 3 },
  },
  {
    model_key: 'flux_1_dev',
    family: 'flux',
    vendor: 'Black Forest Labs',
    display_name: 'Flux.1 dev',
    model_version: '1.0',
    status: 'active',
    is_default: false,
    display_order: 30,
    notes: 'Rewards descriptive prose over keyword salad; negatives are expressed positively inside the sentence.',
    syntax_profile: {
      form: 'prose',
      joiner: ' ',
      slot_order: SLOT_ORDER,
      weights: { syntax: 'none' },
      negative: { mode: 'prose' },
      parameters: { mode: 'fields' },
      aspect: { mode: 'ratio' },
      templates: {
        flash: 'A clean tattoo flash design of {{subject}}, drawn in {{style}} with {{technique}}. {{composition}}. Colors: {{palette}}. {{surface}}. {{detail}}.',
        on_skin: 'A professional studio photograph of a finished {{style}} tattoo on {{placement}}. The design is {{subject}}, rendered with {{technique}} in {{palette}}. {{composition}}. {{surface}}. {{lighting}}. {{detail}}.',
      },
    },
    capabilities: {
      supports_negative_prompt: false,
      supports_weights: false,
      supports_parameters: true,
      supports_conversational_edit: false,
      supports_reference_image: true,
      max_prompt_chars: 2500,
    },
    default_parameters: { steps: 28, guidance: 3.5 },
  },
  {
    model_key: 'midjourney_v7',
    family: 'midjourney',
    vendor: 'Midjourney',
    display_name: 'Midjourney v7',
    model_version: '7',
    status: 'active',
    is_default: false,
    display_order: 40,
    notes: 'Tag phrasing plus trailing flags; --style raw and a low stylize value keep linework literal.',
    syntax_profile: {
      form: 'tags',
      joiner: ', ',
      slot_order: SLOT_ORDER,
      style_suffix: ' tattoo',
      weights: { syntax: 'none' },
      negative: { mode: 'flag', flag: '--no', joiner: ', ' },
      parameters: { mode: 'flags', flags: { aspect: '--ar', style: '--style', stylize: '--stylize' } },
      aspect: { mode: 'ratio' },
    },
    capabilities: {
      supports_negative_prompt: true,
      supports_weights: false,
      supports_parameters: true,
      supports_conversational_edit: false,
      supports_reference_image: true,
      max_prompt_chars: 4000,
    },
    default_parameters: { style: 'raw', stylize: 200 },
  },
  {
    model_key: 'nano_banana',
    family: 'gemini',
    vendor: 'Google',
    display_name: 'Nano Banana (Gemini 2.5 Flash Image)',
    model_version: '2.5',
    status: 'active',
    is_default: false,
    display_order: 50,
    notes: 'Conversational. No flags — describe the image, then refine by chat; it holds the subject between turns.',
    syntax_profile: {
      form: 'prose',
      joiner: ' ',
      slot_order: SLOT_ORDER,
      weights: { syntax: 'none' },
      negative: { mode: 'prose' },
      parameters: { mode: 'none' },
      aspect: { mode: 'sentence' },
      templates: {
        flash: 'Create a {{style}} tattoo design of {{subject}}. Use {{technique}} and a palette of {{palette}}. {{composition}}. {{surface}}. {{detail}}.',
        on_skin: 'Show a {{style}} tattoo of {{subject}} placed on {{placement}}, as a realistic studio photograph. It is rendered with {{technique}} in {{palette}}. {{composition}}. {{surface}}. {{lighting}}. {{detail}}.',
      },
    },
    capabilities: {
      supports_negative_prompt: false,
      supports_weights: false,
      supports_parameters: false,
      supports_conversational_edit: true,
      supports_reference_image: true,
      max_prompt_chars: 3000,
    },
    default_parameters: {},
  },
  {
    model_key: 'sd15_legacy',
    family: 'stable_diffusion',
    vendor: 'Stability AI',
    display_name: 'Stable Diffusion 1.5',
    model_version: '1.5',
    status: 'deprecated',
    is_default: false,
    display_order: 90,
    notes: 'Kept for older local pipelines. Short prompts, heavy negatives, 512px base — not recommended for fine-line work.',
    syntax_profile: {
      form: 'tags',
      joiner: ', ',
      slot_order: ['subject', 'style', 'technique', 'palette', 'surface', 'detail'],
      style_suffix: ' tattoo',
      weights: { syntax: 'sd_parens', emphasis: 1.3, slots: ['style'] },
      negative: { mode: 'field', joiner: ', ' },
      parameters: { mode: 'fields' },
      aspect: { mode: 'dimensions', base: 512 },
    },
    capabilities: {
      supports_negative_prompt: true,
      supports_weights: true,
      supports_parameters: true,
      supports_conversational_edit: false,
      supports_reference_image: true,
      max_prompt_chars: 900,
    },
    default_parameters: { steps: 28, cfg_scale: 7, sampler: 'Euler a' },
  },
];

// The prompt vocabulary Alexei reads out of the database instead of hardcoding.
const PROMPT_BLOCKS = [
  { block_id: 'surface_flash', block_type: 'surface', render_mode: 'flash', applies_to_family: 'all', weight: 1.2, display_order: 10, content: 'isolated on a clean white background, tattoo flash sheet, centered, illustration only, not a photograph' },
  { block_id: 'surface_on_skin', block_type: 'surface', render_mode: 'on_skin', applies_to_family: 'all', weight: 1.2, display_order: 10, content: 'real healed ink on natural skin with visible pores and texture' },
  { block_id: 'quality_flash', block_type: 'quality', render_mode: 'flash', applies_to_family: 'all', weight: 1.2, display_order: 20, content: 'crisp confident linework, high detail, sharp focus' },
  { block_id: 'quality_on_skin', block_type: 'quality', render_mode: 'on_skin', applies_to_family: 'all', weight: null, display_order: 20, content: 'high detail, natural color, shallow depth of field' },
  { block_id: 'lighting_studio', block_type: 'lighting', render_mode: 'on_skin', applies_to_family: 'all', weight: null, display_order: 30, content: 'soft directional studio lighting' },
  { block_id: 'longevity_accents', block_type: 'longevity', render_mode: 'both', applies_to_family: 'all', weight: null, display_order: 40, content: 'key outlines thickened so the design still reads after ten years' },
  { block_id: 'cultural_inspired', block_type: 'cultural', render_mode: 'both', applies_to_family: 'all', weight: null, display_order: 50, content: 'an original abstraction inspired by the tradition, not a replica of a sacred or closed design' },
  { block_id: 'negative_flash', block_type: 'negative', render_mode: 'flash', applies_to_family: 'all', weight: null, display_order: 10, content: 'blurry, muddy lines, color bleed, washed out, watermark, signature, text, jpeg artifacts, photographic background, skin, deformed anatomy, extra limbs' },
  { block_id: 'negative_on_skin', block_type: 'negative', render_mode: 'on_skin', applies_to_family: 'all', weight: null, display_order: 10, content: 'flat sticker look, plastic skin, blurry, color bleed, watermark, signature, text, deformed anatomy, extra limbs, unhealed wound' },
  { block_id: 'negative_fineline', block_type: 'negative', render_mode: 'both', applies_to_family: 'stable_diffusion', weight: null, display_order: 20, content: 'broken lines, double lines, wobbly outlines, sketchy scratchy strokes' },
];

const sql = [];
sql.push(`-- InkTelligence / Alexei "Inkseer" Novak
-- Generated from the synchronized JSON fallback and alexy.zip by generate_t1000_sql.mjs.
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

CREATE TABLE IF NOT EXISTS library_articles (
  article_id VARCHAR(20) NOT NULL,
  slug VARCHAR(190) NOT NULL,
  module ENUM('styles', 'techniques', 'history') NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(255) NOT NULL,
  paper_title VARCHAR(500) NOT NULL,
  dek TEXT NOT NULL,
  curator_note TEXT NOT NULL,
  tags JSON NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  word_count MEDIUMINT UNSIGNED NOT NULL,
  reading_minutes SMALLINT UNSIGNED NOT NULL,
  published_at DATE NOT NULL,
  body LONGTEXT NOT NULL,
  source_sha256 CHAR(64) NOT NULL,
  PRIMARY KEY (article_id),
  UNIQUE KEY uq_library_article_slug (slug),
  UNIQUE KEY uq_library_article_order (display_order),
  KEY ix_library_articles_module (module),
  FULLTEXT KEY ft_library_articles (title, paper_title, dek, body)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS library_article_entries (
  article_id VARCHAR(20) NOT NULL,
  catalog_id VARCHAR(100) NOT NULL,
  catalog_type ENUM('style', 'technique', 'unknown') NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (article_id, catalog_id),
  KEY ix_library_article_entries_catalog (catalog_id),
  CONSTRAINT fk_library_article_entries_article FOREIGN KEY (article_id)
    REFERENCES library_articles (article_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS history_periods (
  period_id VARCHAR(100) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  date_label VARCHAR(100) NOT NULL,
  title VARCHAR(190) NOT NULL,
  summary TEXT NOT NULL,
  source_label VARCHAR(190) NULL,
  source_url VARCHAR(1000) NULL,
  PRIMARY KEY (period_id),
  UNIQUE KEY uq_history_period_order (display_order),
  FULLTEXT KEY ft_history_periods (title, summary)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS history_period_styles (
  period_id VARCHAR(100) NOT NULL,
  style_id VARCHAR(100) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (period_id, style_id),
  CONSTRAINT fk_history_period_styles_period FOREIGN KEY (period_id)
    REFERENCES history_periods (period_id) ON DELETE CASCADE,
  CONSTRAINT fk_history_period_styles_style FOREIGN KEY (style_id)
    REFERENCES styles (style_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS anthropology_lenses (
  lens_id VARCHAR(100) NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  title VARCHAR(190) NOT NULL,
  description TEXT NOT NULL,
  icon_key VARCHAR(50) NOT NULL,
  PRIMARY KEY (lens_id),
  UNIQUE KEY uq_anthropology_lens_order (display_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_roles (
  role_id VARCHAR(100) NOT NULL,
  name VARCHAR(190) NOT NULL,
  description TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (role_id),
  UNIQUE KEY uq_app_role_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_users (
  user_id CHAR(36) NOT NULL,
  login VARCHAR(190) NOT NULL,
  display_name VARCHAR(190) NOT NULL,
  role_id VARCHAR(100) NOT NULL,
  credential_source ENUM('environment', 'password_hash', 'oauth') NOT NULL DEFAULT 'environment',
  status ENUM('active', 'dormant', 'suspended') NOT NULL DEFAULT 'dormant',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_app_user_login (login),
  CONSTRAINT fk_app_users_role FOREIGN KEY (role_id)
    REFERENCES app_roles (role_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS membership_packages (
  package_id VARCHAR(100) NOT NULL,
  name VARCHAR(190) NOT NULL,
  audience VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  monthly_price_eur DECIMAL(8,2) NULL,
  future_image_credits INT UNSIGNED NOT NULL DEFAULT 0,
  features JSON NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL,
  status ENUM('draft', 'active', 'retired') NOT NULL DEFAULT 'draft',
  PRIMARY KEY (package_id),
  UNIQUE KEY uq_membership_package_order (display_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS app_feature_flags (
  flag_key VARCHAR(100) NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT NOT NULL,
  PRIMARY KEY (flag_key)
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
  default_language VARCHAR(16) NOT NULL DEFAULT 'en',
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
  language_code VARCHAR(16) NOT NULL DEFAULT 'en',
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

-- Prompt build system -------------------------------------------------------
-- The generator registry is data, not code: a new image model is a row here,
-- and lib/prompt renders it from syntax_profile without a deploy.

CREATE TABLE IF NOT EXISTS image_models (
  model_key VARCHAR(100) NOT NULL,
  family VARCHAR(50) NOT NULL,
  vendor VARCHAR(100) NOT NULL,
  display_name VARCHAR(190) NOT NULL,
  model_version VARCHAR(50) NOT NULL,
  status ENUM('active', 'preview', 'deprecated') NOT NULL DEFAULT 'active',
  syntax_profile JSON NOT NULL,
  capabilities JSON NOT NULL,
  default_parameters JSON NOT NULL,
  notes TEXT NOT NULL,
  display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (model_key),
  KEY ix_image_models_status (status, display_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prompt_blocks (
  block_id VARCHAR(100) NOT NULL,
  block_type ENUM('surface', 'quality', 'lighting', 'longevity', 'cultural', 'negative') NOT NULL,
  render_mode ENUM('flash', 'on_skin', 'both') NOT NULL DEFAULT 'both',
  applies_to_family VARCHAR(50) NOT NULL DEFAULT 'all',
  content TEXT NOT NULL,
  weight DECIMAL(3,2) NULL,
  display_order SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (block_id),
  KEY ix_prompt_blocks_lookup (block_type, render_mode, applies_to_family, display_order)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prompt_builds (
  build_id CHAR(36) NOT NULL,
  session_id CHAR(36) NULL,
  design_spec JSON NOT NULL,
  prompt_ir JSON NOT NULL,
  catalog_refs JSON NOT NULL,
  render_mode ENUM('flash', 'on_skin') NOT NULL DEFAULT 'flash',
  cultural_check ENUM('clear', 'inspired_not_copied', 'flagged') NOT NULL DEFAULT 'clear',
  warnings JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (build_id),
  KEY ix_prompt_builds_session (session_id, created_at),
  CONSTRAINT fk_prompt_builds_session FOREIGN KEY (session_id)
    REFERENCES consultation_sessions (session_id) ON DELETE SET NULL
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS prompt_build_renders (
  render_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  build_id CHAR(36) NOT NULL,
  model_key VARCHAR(100) NOT NULL,
  prompt LONGTEXT NOT NULL,
  negative_prompt LONGTEXT NULL,
  parameters JSON NOT NULL,
  char_count INT UNSIGNED NOT NULL,
  truncated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (render_id),
  UNIQUE KEY uq_render_build_model (build_id, model_key),
  CONSTRAINT fk_renders_build FOREIGN KEY (build_id)
    REFERENCES prompt_builds (build_id) ON DELETE CASCADE,
  CONSTRAINT fk_renders_model FOREIGN KEY (model_key)
    REFERENCES image_models (model_key)
) ENGINE=InnoDB;

ALTER TABLE ai_agents
  MODIFY COLUMN default_language VARCHAR(16) NOT NULL DEFAULT 'en';
ALTER TABLE consultation_sessions
  MODIFY COLUMN language_code VARCHAR(16) NOT NULL DEFAULT 'en';
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

sql.push(upsert('history_periods', [
  'period_id', 'display_order', 'date_label', 'title', 'summary', 'source_label', 'source_url',
], database.history.periods.map((item) => [
  item.id,
  item.displayOrder,
  item.dateLabel,
  item.title,
  item.summary,
  item.sourceLabel,
  item.sourceUrl,
]), ['display_order', 'date_label', 'title', 'summary', 'source_label', 'source_url']));

sql.push(upsert('history_period_styles', [
  'period_id', 'style_id', 'display_order',
], database.history.periods.flatMap((item) => item.styleIds.map((styleId, index) => [
  item.id,
  styleId,
  index + 1,
])), ['display_order']));

sql.push(upsert('anthropology_lenses', [
  'lens_id', 'display_order', 'title', 'description', 'icon_key',
], database.history.anthropologyLenses.map((item) => [
  item.id,
  item.displayOrder,
  item.title,
  item.description,
  item.icon,
]), ['display_order', 'title', 'description', 'icon_key']));

sql.push(upsert('library_articles', [
  'article_id', 'slug', 'module', 'display_order', 'title', 'paper_title', 'dek', 'curator_note',
  'tags', 'file_name', 'word_count', 'reading_minutes', 'published_at', 'body', 'source_sha256',
], libraryArticles.map((item) => [
  item.id,
  item.slug,
  item.module,
  item.order,
  item.title,
  item.paperTitle,
  item.dek,
  item.curatorNote,
  json(item.tags),
  item.file,
  item.wordCount,
  item.readingMinutes,
  item.publishedAt,
  item.body,
  item.sha256,
]), ['slug', 'module', 'display_order', 'title', 'paper_title', 'dek', 'curator_note', 'tags', 'file_name', 'word_count', 'reading_minutes', 'published_at', 'body', 'source_sha256']));

sql.push(upsert('library_article_entries', [
  'article_id', 'catalog_id', 'catalog_type', 'display_order',
], libraryArticles.flatMap((item) => item.catalogIds.map((catalogId, index) => [
  item.id,
  catalogId,
  styleById.has(catalogId) ? 'style' : techniqueById.has(catalogId) ? 'technique' : 'unknown',
  index + 1,
])), ['catalog_type', 'display_order']));

sql.push(upsert('app_roles', [
  'role_id', 'name', 'description', 'is_active',
], [
  ['super_admin', 'Super Administrator', 'Full owner access to the private studio, data, and future platform controls.', 1],
  ['member', 'Member', 'Future customer account for saved consultations, designs, and generation credits.', 0],
], ['name', 'description', 'is_active']));

sql.push(upsert('app_users', [
  'user_id', 'login', 'display_name', 'role_id', 'credential_source', 'status',
], [[
  '00000000-0000-4000-8000-000000000001',
  'owner',
  'InkTelligence Owner',
  'super_admin',
  'environment',
  'active',
]], ['login', 'display_name', 'role_id', 'credential_source', 'status']));

sql.push(upsert('membership_packages', [
  'package_id', 'name', 'audience', 'description', 'monthly_price_eur', 'future_image_credits', 'features', 'display_order', 'status',
], [
  ['seeker', 'Seeker', 'For a first meaningful tattoo', 'A guided path from personal story to a clear, artist-ready tattoo direction.', 12, 20, json(['AI consultation', 'Full style compendium', 'Placement and longevity guidance', 'Future: 20 image studies']), 1, 'draft'],
  ['collector', 'Collector', 'For people building a body of work', 'Deeper concept development, saved projects, and more room to compare visual directions.', 29, 100, json(['Everything in Seeker', 'Saved tattoo projects', 'Style fusion planning', 'Future: 100 image studies']), 2, 'draft'],
  ['studio', 'Studio', 'For tattoo artists and creative studios', 'A professional workspace for client discovery, briefs, references, and future image exploration.', 79, 400, json(['Everything in Collector', 'Client workspaces', 'Reusable studio briefs', 'Future: 400 image studies']), 3, 'draft'],
], ['name', 'audience', 'description', 'monthly_price_eur', 'future_image_credits', 'features', 'display_order', 'status']));

sql.push(upsert('app_feature_flags', [
  'flag_key', 'enabled', 'description',
], [
  ['public_user_registration', 0, 'Future member registration; intentionally dormant.'],
  ['membership_billing', 0, 'Paid membership activation; packages remain in draft.'],
  ['image_generation', 0, 'Tattoo concept image generation; planned, not yet available.'],
], ['enabled', 'description']));

// Image model registry. Adding a generator means adding a row here — the renderer in
// lib/prompt reads syntax_profile and needs no code change for a new target.
sql.push(upsert('image_models', [
  'model_key', 'family', 'vendor', 'display_name', 'model_version', 'status',
  'syntax_profile', 'capabilities', 'default_parameters', 'notes', 'display_order', 'is_default',
], IMAGE_MODELS.map((model) => [
  model.model_key, model.family, model.vendor, model.display_name, model.model_version, model.status,
  json(model.syntax_profile), json(model.capabilities), json(model.default_parameters),
  model.notes, model.display_order, model.is_default ? 1 : 0,
]), ['family', 'vendor', 'display_name', 'model_version', 'status', 'syntax_profile', 'capabilities', 'default_parameters', 'notes', 'display_order', 'is_default']));

sql.push(upsert('prompt_blocks', [
  'block_id', 'block_type', 'render_mode', 'applies_to_family', 'content', 'weight', 'display_order', 'is_active',
], PROMPT_BLOCKS.map((block) => [
  block.block_id, block.block_type, block.render_mode, block.applies_to_family,
  block.content, block.weight ?? null, block.display_order, 1,
]), ['block_type', 'render_mode', 'applies_to_family', 'content', 'weight', 'display_order', 'is_active']));

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
  'en',
  '03_SYSTEM_PROMPT.md',
  '04_IMAGE_PROMPT_TEMPLATE.md',
  '05_EXAMPLE_end_to_end.md',
  json({
    respond_in_client_language: false,
    response_language: 'en',
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
  s.narrative_language,
  s.source_payload
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
  t.narrative_language,
  t.source_payload
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

CREATE OR REPLACE VIEW v_image_model_registry AS
SELECT
  m.model_key,
  m.family,
  m.vendor,
  m.display_name,
  m.model_version,
  m.status,
  m.syntax_profile,
  m.capabilities,
  m.default_parameters,
  m.notes,
  m.is_default
FROM image_models AS m
WHERE m.status <> 'deprecated'
ORDER BY m.display_order;

CREATE OR REPLACE VIEW v_prompt_build_bundle AS
SELECT
  b.build_id,
  b.session_id,
  b.render_mode,
  b.cultural_check,
  b.design_spec,
  b.prompt_ir,
  b.catalog_refs,
  b.warnings,
  b.created_at,
  r.model_key,
  m.display_name AS model_name,
  m.family AS model_family,
  r.prompt,
  r.negative_prompt,
  r.parameters,
  r.char_count,
  r.truncated
FROM prompt_builds AS b
JOIN prompt_build_renders AS r ON r.build_id = b.build_id
JOIN image_models AS m ON m.model_key = r.model_key;

SET FOREIGN_KEY_CHECKS = @OLD_FOREIGN_KEY_CHECKS;

-- Verification queries (optional):
-- SELECT * FROM import_manifest;
-- SELECT COUNT(*) FROM styles;            -- 66
-- SELECT COUNT(*) FROM techniques;        -- 44
-- SELECT COUNT(*) FROM mixed_styles;      -- 6
-- SELECT COUNT(*) FROM library_articles;  -- 30
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
    ['history periods', database.history.periods.length, expected.historyPeriods],
    ['anthropology lenses', database.history.anthropologyLenses.length, expected.anthropologyLenses],
  ];
  for (const [label, actual, declared] of checks) {
    if (actual !== declared) throw new Error(`Invalid ${label} count: declared ${declared}, found ${actual}`);
  }

  assertUnique(database.styleCategories, 'style category');
  assertUnique(database.techniqueCategories, 'technique category');
  assertUnique(database.styles, 'style');
  assertUnique(database.techniques, 'technique');
  assertUnique(database.history.periods, 'history period');
  assertUnique(database.history.anthropologyLenses, 'anthropology lens');

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
  for (const period of database.history.periods) {
    for (const id of period.styleIds) if (!styleIds.has(id)) throw new Error(`Unknown history style ${id}`);
  }

  validateLibrary(styleIds, techniqueIds);
}

function validateLibrary(styleIds, techniqueIds) {
  const articles = database.articles || [];
  if (articles.length !== database.meta.counts.articles) {
    throw new Error(`Invalid article count: declared ${database.meta.counts.articles}, found ${articles.length}`);
  }
  assertUnique(articles, 'library article');

  const slugs = new Set();
  const orders = new Set();
  const covered = new Set();
  for (const article of articles) {
    if (slugs.has(article.slug)) throw new Error(`Duplicate article slug: ${article.slug}`);
    slugs.add(article.slug);
    if (orders.has(article.order)) throw new Error(`Duplicate article order: ${article.order}`);
    orders.add(article.order);
    if (!fs.existsSync(new URL(article.file, libraryDirectory))) {
      throw new Error(`Missing library paper file: ${article.file}`);
    }
    for (const id of article.catalogIds) {
      if (!styleIds.has(id) && !techniqueIds.has(id)) throw new Error(`Unknown catalog id ${id} in article ${article.id}`);
      covered.add(id);
    }
  }

  // Every catalog entry must be documented by a paper and carry its enrichment.
  for (const entry of [...database.styles, ...database.techniques]) {
    if (!covered.has(entry.id)) throw new Error(`Catalog entry ${entry.id} is not covered by any library article`);
    if (!entry.sourcePaper) throw new Error(`Catalog entry ${entry.id} is missing sourcePaper`);
    if (!slugs.size || !articles.some((article) => article.id === entry.sourcePaper)) {
      throw new Error(`Catalog entry ${entry.id} references unknown paper ${entry.sourcePaper}`);
    }
    if (!entry.fieldNote) throw new Error(`Catalog entry ${entry.id} is missing fieldNote`);
    if (!Array.isArray(entry.keyFacts) || !entry.keyFacts.length) {
      throw new Error(`Catalog entry ${entry.id} is missing keyFacts`);
    }
    for (const fact of entry.keyFacts) {
      if (!EVIDENCE_LABELS.has(fact.evidence)) {
        throw new Error(`Catalog entry ${entry.id} has an invalid evidence label: ${fact.evidence}`);
      }
    }
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
