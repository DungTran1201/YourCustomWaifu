import type { InjectionKey, Ref } from "vue";

export type AuthSceneState =
  "initializing" | "loading-vrm" | "ready" | "static-fallback";

export interface AuthEnvironmentContext {
  isEmbeddedIn3DStage: boolean;
  sceneState: Readonly<Ref<AuthSceneState>>;
  reducedMotion: Readonly<Ref<boolean>>;
  notifyInputFocus: () => void;
  notifyInputBlur: () => void;
  notifyUserTyping: () => void;
  notifySubmitting: (submitting: boolean) => void;
}

export const AUTH_ENVIRONMENT_KEY: InjectionKey<AuthEnvironmentContext> =
  Symbol("YourCustomWaifuAuthEnvironment");
