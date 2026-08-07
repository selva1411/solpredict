/**
 * RC-5 enforcement rules (SolPredict).
 *
 * These encode the "Definition of done" hard rules so the build fails
 * (rather than silently degrading) the moment a regression is committed:
 *
 *   1. no-empty-promise-catch — flags `.catch(() => {})` and `.catch(err => {})`
 *      with an empty body. A swallowed rejection is how errors vanish and the
 *      app shows stale zeros. Use `.catch(err => setError(err.message))` or
 *      a `void` + explicit comment instead.
 *
 *   2. no-fetch-in-effect — flags bare `fetch(...)` calls nested inside a
 *      `useEffect`. Data loads must go through the keyed React Query hooks
 *      (lib/api/keys.ts). Server Components fetch directly. Client code never
 *      calls fetch inside an effect.
 */
export const rc5Rules = {
  "no-empty-promise-catch": {
    meta: {
      type: "problem",
      docs: { description: "Disallow .catch() with an empty body (swallows errors)" },
      messages: {
        empty: "Do not swallow fetch/promise errors with an empty .catch(). Surface an error state instead.",
      },
    },
    create(context) {
      const isArrowFn = (n) => n && (
        (n.type === "ArrowFunctionExpression") ||
        (n.type === "FunctionExpression")
      );
      const bodyEmpty = (n) => {
        if (!n) return false;
        if (n.type === "BlockStatement") return n.body.length === 0;
        if (n.type === "Literal" && (n.value === undefined || n.value === null)) return true;
        return false;
      };
      // True if the promise chain this .catch() belongs to is data-loading
      // (rooted in a fetch(...) call), i.e. it risks swallowing a network
      // failure and rendering stale zeros. Side-effect chains such as
      // clipboard.writeText() or redis.unsubscribe() are intentionally ignored.
      const chainRootsInFetch = (memberExpr) => {
        let expr = memberExpr.object;
        while (expr) {
          if (expr.type === "CallExpression") {
            const c = expr.callee;
            // Global fetch(...) is an Identifier call. A MemberExpression
            // like program.account.config.fetch(...) is an Anchor program
            // account read, NOT network I/O.
            if (c.type === "Identifier" && c.name === "fetch") return true;
            return false;
          }
          if (expr.type === "MemberExpression") { expr = expr.object; continue; }
          return false;
        }
        return false;
      };
      return {
        CallExpression(node) {
          const callee = node.callee;
          if (
            callee.type !== "MemberExpression" ||
            callee.property.type !== "Identifier" ||
            callee.property.name !== "catch"
          ) return;
          if (!chainRootsInFetch(callee)) return;
          const arg = node.arguments && node.arguments[0];
          if (!isArrowFn(arg)) return;
          if (bodyEmpty(arg.body)) {
            context.report({ node, messageId: "empty" });
          }
        },
      };
    },
  },

  "no-fetch-in-effect": {
    meta: {
      type: "problem",
      docs: { description: "Disallow fetch() inside useEffect" },
      messages: {
        effect: "Do not call fetch() inside useEffect. Use the React Query data layer (lib/api/keys.ts) or a Server Component.",
      },
    },
    create(context) {
      return {
        CallExpression(node) {
          const callee = node.callee;
          if (
            callee.type !== "Identifier" || callee.name !== "fetch"
          ) return;
          let cur = node;
          const seen = new Set();
          while (cur && !seen.has(cur)) {
            seen.add(cur);
            if (
              cur.type === "CallExpression" &&
              cur.callee.type === "Identifier" &&
              cur.callee.name === "useEffect"
            ) {
              context.report({ node, messageId: "effect" });
              return;
            }
            cur = cur.parent;
          }
        },
      };
    },
  },
};
