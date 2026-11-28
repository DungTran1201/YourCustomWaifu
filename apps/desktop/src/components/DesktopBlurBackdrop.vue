<script setup lang="ts">
import { computed, type CSSProperties } from "vue";
import { useAppStore } from "@vrm/app-core";

const props = withDefaults(
  defineProps<{
    borderRadius?: string;
    clipStyle?: Record<string, string>;
  }>(),
  {
    borderRadius: "var(--radius-window, 24px)",
    clipStyle: undefined,
  },
);

const store = useAppStore();
const backdrop = computed(() => store.state.desktopBackdrop);

const containerStyle = computed(() => {
  const b = backdrop.value;
  const radius = b?.isMaximized ? "0px" : props.borderRadius;
  return {
    borderRadius: radius,
    backgroundColor: b?.backgroundColor || "transparent",
    ...(props.clipStyle || {}),
  };
});

const imgStyle = computed<CSSProperties>(() => {
  const b = backdrop.value;
  if (!b) return {};

  const left = b.displayBounds.x - b.windowBounds.x;
  const top = b.displayBounds.y - b.windowBounds.y;
  const width = Math.max(1, b.displayBounds.width);
  const height = Math.max(1, b.displayBounds.height);

  if (b.style === "tile") {
    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
      backgroundImage: `url("${b.imageUrl}")`,
      backgroundRepeat: "repeat",
      backgroundPosition: "0 0",
    };
  }

  const objectFit: CSSProperties["objectFit"] =
    b.style === "fit"
      ? "contain"
      : b.style === "stretch"
        ? "fill"
        : b.style === "center"
          ? "none"
          : "cover";

  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
    objectFit,
    objectPosition: "center center",
  };
});
</script>

<template>
  <div
    v-if="backdrop?.imageUrl"
    class="desktop-blur-backdrop"
    :style="containerStyle"
    aria-hidden="true"
  >
    <div
      v-if="backdrop.style === 'tile'"
      class="desktop-blur-layer desktop-blur-tile"
      :style="imgStyle"
    ></div>
    <img
      v-else
      :src="backdrop.imageUrl"
      class="desktop-blur-layer"
      :style="imgStyle"
      alt=""
      draggable="false"
    />
    <div class="desktop-blur-tint"></div>
  </div>
</template>

<style scoped>
.desktop-blur-backdrop {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  user-select: none;
}

.desktop-blur-layer {
  position: absolute;
  display: block;
  pointer-events: none;
  filter: blur(22px) saturate(135%);
  -webkit-filter: blur(22px) saturate(135%);
  will-change: transform, left, top;
}

.desktop-blur-tint {
  position: absolute;
  inset: 0;
  background: var(--window-backdrop-tint);
  transition: background-color 220ms ease;
}
</style>
