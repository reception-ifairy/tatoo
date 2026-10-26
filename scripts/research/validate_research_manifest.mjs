#!/usr/bin/env node

import fs from "node:fs";

const database = JSON.parse(fs.readFileSync(new URL("../database/tattoo_database.backup.json", import.meta.url), "utf8"));
const manifest = JSON.parse(fs.readFileSync(new URL("../../docs/research/research-corpus-manifest.json", import.meta.url), "utf8"));
const libraryDirectory = new URL("../../data/library/", import.meta.url);

const modules = {
  styles: manifest.papers.filter((paper) => paper.module === "styles"),
  techniques: manifest.papers.filter((paper) => paper.module === "techniques"),
  history: manifest.papers.filter((paper) => paper.module === "history"),
};

for (const [moduleName, papers] of Object.entries(modules)) {
  if (papers.length !== 10) throw new Error(`${moduleName} must contain exactly 10 papers; found ${papers.length}`);
}

assertExactCoverage("styles", database.styles.map((item) => item.id), modules.styles.flatMap((paper) => paper.catalogIds));
assertExactCoverage("techniques", database.techniques.map((item) => item.id), modules.techniques.flatMap((paper) => paper.catalogIds));
assertAtLeastOnce("history periods", database.history.periods.map((item) => item.id), modules.history.flatMap((paper) => paper.periodIds));
assertAtLeastOnce("anthropology lenses", database.history.anthropologyLenses.map((item) => item.id), modules.history.flatMap((paper) => paper.lensIds));
assertLibraryParity();

console.log(JSON.stringify({
  valid: true,
  papers: manifest.papers.length,
  libraryArticles: database.articles.length,
  stylePapers: modules.styles.length,
  stylesCovered: database.styles.length,
  techniquePapers: modules.techniques.length,
  techniquesCovered: database.techniques.length,
  historyPapers: modules.history.length,
  periodsCovered: database.history.periods.length,
  lensesCovered: database.history.anthropologyLenses.length
}, null, 2));

/** Every manifest paper must exist on disk and match the shipped library article. */
function assertLibraryParity() {
  const articles = new Map(database.articles.map((item) => [item.id, item]));
  assertAtLeastOnce("library articles", manifest.papers.map((paper) => paper.id), [...articles.keys()]);

  for (const paper of manifest.papers) {
    const article = articles.get(paper.id);
    if (paper.file && article.file !== paper.file) {
      throw new Error(`${paper.id} file mismatch: manifest=${paper.file}, library=${article.file}`);
    }
    if (paper.slug && article.slug !== paper.slug) {
      throw new Error(`${paper.id} slug mismatch: manifest=${paper.slug}, library=${article.slug}`);
    }
    if (!fs.existsSync(new URL(article.file, libraryDirectory))) {
      throw new Error(`${paper.id} paper file is missing: data/library/${article.file}`);
    }
    const manifestCatalog = [...(paper.catalogIds || [])].sort();
    const articleCatalog = [...article.catalogIds].sort();
    if (JSON.stringify(manifestCatalog) !== JSON.stringify(articleCatalog)) {
      throw new Error(`${paper.id} catalog assignment differs between the manifest and the library article`);
    }
  }
}

function assertExactCoverage(label, expectedIds, actualIds) {
  assertAtLeastOnce(label, expectedIds, actualIds);
  const duplicates = actualIds.filter((id, index) => actualIds.indexOf(id) !== index);
  if (duplicates.length) throw new Error(`${label} assigned more than once: ${[...new Set(duplicates)].join(", ")}`);
}

function assertAtLeastOnce(label, expectedIds, actualIds) {
  const expected = new Set(expectedIds);
  const actual = new Set(actualIds);
  const missing = [...expected].filter((id) => !actual.has(id));
  const unknown = [...actual].filter((id) => !expected.has(id));
  if (missing.length || unknown.length) throw new Error(`${label} mismatch; missing=[${missing.join(", ")}], unknown=[${unknown.join(", ")}]`);
}
