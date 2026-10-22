import type { Bindings } from "../src/types";

// Types `env` from "cloudflare:workers" with this Worker's bindings.
declare global {
  namespace Cloudflare {
    interface Env extends Bindings {}
  }
}
