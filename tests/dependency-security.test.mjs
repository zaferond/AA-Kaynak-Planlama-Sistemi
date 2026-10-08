import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";

const frontendRequire = createRequire(
  new URL("../frontend/package.json", import.meta.url),
);
const postcssRequire = createRequire(frontendRequire.resolve("postcss"));
const { SourceMapConsumer, SourceMapGenerator } =
  postcssRequire("source-map-js");
const flatMap = {
  version: 3,
  sources: ["synthetic.css"],
  names: [],
  mappings: "AAAA",
};
const indexed = (line, map = flatMap, column = 0) => ({
  version: 3,
  sections: [{ offset: { line, column }, map }],
});

test("PostCSS's installed source-map dependency rejects excessive, nested and invalid offsets before expansion", () => {
  // Only construct consumers: never expand malicious mappings into large text.
  for (const map of [
    indexed(1e9),
    indexed(6e6, indexed(6e6)),
    indexed(Infinity),
    indexed(-1),
    indexed(0.5),
    indexed("100"),
    indexed(0, flatMap, -1),
  ])
    assert.throws(() => new SourceMapConsumer(map), /offset/i);
});

test("the patched source-map dependency preserves ordinary CSS mapping round trips", () => {
  const generator = new SourceMapGenerator({ file: "synthetic.css" });
  generator.addMapping({
    generated: { line: 2, column: 0 },
    original: { line: 7, column: 2 },
    source: "kaynak.css",
  });
  generator.setSourceContent("kaynak.css", "/* Türkçe: ıİşğ */");
  const original = new SourceMapConsumer(generator.toJSON());
  const rebuilt = new SourceMapConsumer(
    SourceMapGenerator.fromSourceMap(original).toJSON(),
  );
  assert.deepEqual(rebuilt.originalPositionFor({ line: 2, column: 0 }), {
    source: "kaynak.css",
    line: 7,
    column: 2,
    name: null,
  });
  assert.equal(rebuilt.sourceContentFor("kaynak.css"), "/* Türkçe: ıİşğ */");
});

// Temporary exposure guard for GHSA-hp3w-g68c-fv3c, NOT a sprintf-js patch.
// Fail for an unfamiliar import/alias/call shape so upgrades require review.
function reviewedSprintfFormats(source, filename) {
  const ast = ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const bindings = new Map(),
    formats = [];
  function imports(node) {
    if (ts.isStringLiteral(node) && node.text === "sprintf-js") {
      const call = node.parent,
        declaration = call.parent;
      assert(
        ts.isCallExpression(call) &&
          ts.isIdentifier(call.expression) &&
          call.expression.text === "require",
        filename,
      );
      assert(
        ts.isVariableDeclaration(declaration) &&
          declaration.initializer === call &&
          ts.isIdentifier(declaration.name),
        filename,
      );
      bindings.set(declaration.name.text, declaration.name);
    }
    ts.forEachChild(node, imports);
  }
  imports(ast);
  function calls(node) {
    if (
      ts.isIdentifier(node) &&
      bindings.has(node.text) &&
      bindings.get(node.text) !== node
    ) {
      let expression = node.parent;
      assert(
        ts.isPropertyAccessExpression(expression) &&
          expression.expression === node &&
          expression.name.text === "sprintf",
        filename,
      );
      while (
        ts.isParenthesizedExpression(expression.parent) ||
        (ts.isBinaryExpression(expression.parent) &&
          expression.parent.operatorToken.kind === ts.SyntaxKind.CommaToken &&
          expression.parent.right === expression)
      )
        expression = expression.parent;
      const call = expression.parent;
      assert(
        ts.isCallExpression(call) && call.expression === expression,
        filename,
      );
      const format = call.arguments[0];
      assert(
        format && ts.isStringLiteral(format),
        "Dynamic sprintf format: " + filename,
      );
      assert(
        !format.text.replace(/%(?:%|s|d|0[248]X)/g, "").includes("%"),
        "Unreviewed sprintf precision/width: " + filename,
      );
      formats.push(format.text);
    }
    ts.forEachChild(node, calls);
  }
  calls(ast);
  return formats;
}

test("the sprintf exposure guard rejects dynamic formats, precision and escaping aliases", () => {
  for (const call of [
    "s.sprintf(input, 1)",
    "s.sprintf('%.101f', 1)",
    "const alias=s.sprintf; alias(input,1)",
    "s['sprintf'](input,1)",
  ])
    assert.throws(() =>
      reviewedSprintfFormats(
        "const s=require('sprintf-js'); " + call,
        "synthetic.js",
      ),
    );
});

test("installed Tedious uses only reviewed literal sprintf formats; format-looking values remain data", async (t) => {
  const require = createRequire(import.meta.url);
  const mssqlRequire = createRequire(require.resolve("mssql"));
  const tediousRequire = createRequire(mssqlRequire.resolve("tedious"));
  const lib = path.dirname(mssqlRequire.resolve("tedious"));
  const formats = [];
  for (const relative of await fs.readdir(lib, { recursive: true })) {
    if (!relative.endsWith(".js")) continue;
    formats.push(
      ...reviewedSprintfFormats(
        await fs.readFile(path.join(lib, relative), "utf8"),
        relative,
      ),
    );
  }
  assert(
    formats.length > 0,
    "Tedious formatting changed; re-evaluate the advisory",
  );
  const { sprintf } = tediousRequire("sprintf-js");
  for (const format of formats) {
    const args = [...format.matchAll(/%(s|d|0[248]X)/g)].map((match) =>
      match[1] === "s" ? "%.101f" : 1,
    );
    assert.doesNotThrow(() => sprintf(format, ...args));
    if (format.includes("%s"))
      assert(sprintf(format, ...args).includes("%.101f"));
  }
  t.diagnostic(
    `Reviewed ${formats.length} static format calls; no database connection made. The upstream advisory remains open.`,
  );
});
