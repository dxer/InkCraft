// @joplin/turndown 系列不自带类型声明，这里按上游 API 形状补齐
declare module "@joplin/turndown" {
  import TurndownService from "turndown";
  export default TurndownService;
}

declare module "@joplin/turndown-plugin-gfm" {
  type Plugin = (service: unknown) => void;
  export const gfm: Plugin;
  export const tables: Plugin;
  export const strikethrough: Plugin;
  export const taskListItems: Plugin;
  export const highlightedCodeBlock: Plugin;
}
