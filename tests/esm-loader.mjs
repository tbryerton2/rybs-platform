const SERVER_ONLY_STUB_URL = "data:text/javascript,export default undefined;";

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      shortCircuit: true,
      url: SERVER_ONLY_STUB_URL,
    };
  }

  if (specifier.startsWith("@/")) {
    return resolveWithTsFallback(new URL(`../src/${specifier.slice(2)}`, import.meta.url).href, context, nextResolve);
  }

  return resolveWithTsFallback(specifier, context, nextResolve);
}

async function resolveWithTsFallback(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND" || specifier.endsWith(".ts")) {
      throw error;
    }

    return nextResolve(`${specifier}.ts`, context);
  }
}
