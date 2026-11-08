/// <reference types="vite/client" />
/** Where the Supertonic 3 files are fetched from (Hugging Face in production, local files in dev). */
declare const __MODEL_BASE__: string;
/** Short git hash of the build ("dev" outside git). */
declare const __APP_VERSION__: string;
/** When the build was made, ISO 8601. */
declare const __BUILD_TIME__: string;

declare module "*.css";
