// onnxruntime-react-native 1.24 reaches the JS runtime through RCTCxxBridge, which React Native 0.82+ removed
// (the legacy architecture is gone), so its iOS module no longer compiles. In bridgeless mode the module's
// `bridge` is an RCTBridgeProxy, which still answers -runtime and -jsCallInvoker; this rewrites the install
// method to ask for the runtime by selector instead of casting to RCTCxxBridge. Runs on every install
// (root postinstall, also on EAS) and does nothing when already applied. Fails loudly if the file changed,
// so an onnxruntime update is noticed instead of silently building the old code.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const MARK = "// audiokniha: bridgeless install (scripts/patch-onnxruntime.mjs)";
const require = createRequire(import.meta.url);
// An explicit path (first argument) patches a copy instead, for checking the patch.
const file = process.argv[2] ?? join(dirname(require.resolve("onnxruntime-react-native/package.json")), "ios", "OnnxruntimeModule.mm");
let src = readFileSync(file, "utf8");

if (src.includes(MARK)) {
  console.log("patch-onnxruntime: already applied");
} else {
  const start = src.indexOf("RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {");
  const end = src.indexOf("- (void)dealloc");
  const importAnchor = "#import <Foundation/Foundation.h>";
  if (start < 0 || end < start || !src.includes(importAnchor) || !src.includes("RCTCxxBridge")) {
    throw new Error(`patch-onnxruntime: ${file} is not the expected 1.24 source; check whether the patch is still needed`);
  }
  const install = `${MARK}
RCT_EXPORT_BLOCKING_SYNCHRONOUS_METHOD(install) {
  @try {
    id bridge = _bridge;
    // RCTCxxBridge (old architecture) and RCTBridgeProxy (bridgeless) both implement -runtime.
    if (bridge == nil || !class_respondsToSelector(object_getClass(bridge), @selector(runtime))) {
      return @false;
    }
    void *runtimePtr = ((void *(*)(id, SEL))objc_msgSend)(bridge, @selector(runtime));
    if (runtimePtr == nullptr) {
      return @false;
    }
    auto& runtime = *(facebook::jsi::Runtime*)runtimePtr;
    auto jsiInvoker = _bridge.jsCallInvoker;

    env = onnxruntimejsi::install(runtime, jsiInvoker);

    return @true;
  } @catch (...) {
    return @false;
  }
}

`;
  src = src.slice(0, start) + install + src.slice(end);
  src = src.replace(importAnchor, `${importAnchor}\n#import <objc/message.h>\n#import <objc/runtime.h>`);
  writeFileSync(file, src);
  console.log("patch-onnxruntime: applied");
}
