export function replacePlugin() {
  return {
    name: "replace-1-with-2",
    visitor: {
      NumericLiteral(path) {
        if (path.node.value === 1) {
          path.node.value = 2;
        }
      },
    },
  };
}
