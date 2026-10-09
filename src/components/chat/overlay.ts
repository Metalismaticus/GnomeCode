/** Разметка оверлеев чата: поверхности, внутри которых открытый оверлей
 *  переживает клик, и селектор бейджа модели — якорь возврата фокуса. */

/** Бейдж модели в шапке: панель сравнения открыта им — фокус возвращается
 *  к нему (спека «Клавиатура»). */
export const MODEL_BADGE = '[data-testid="model-badge"]';

/** Поверхности-оверлеи чата: классы окон держат их компоненты (AddMenu,
 *  PluginPicker, ToolSetPicker, CatalogPicker, PluginSummary, PluginApproval,
 *  ChatPluginsPanel, ComparePanel, HeaderMenu), метки — кнопки и области шапки
 *  и композера, которыми оверлей открыт и которые его закрывать не должны:
 *  «⋯» переключает меню и панель «Контекст проекта» не закрывает (спека
 *  «тихого хрома», §6), бейдж модели — вход сравнения. */
const SURFACES = [
  ".add-menu",
  ".plugin-picker",
  ".toolset-picker",
  ".catalog-picker",
  ".plugin-summary",
  ".plugin-approval",
  ".chat-plugins",
  ".compare-panel",
  ".header-menu",
  '[data-testid="composer-add"]',
  MODEL_BADGE,
  '[data-testid="header-more"]',
] as const;

/** Цель клика вне всех поверхностей-оверлеев — жест «снаружи»: оверлей
 *  закрывается. Цель может отсутствовать (клик мимо документа). */
export function outsideOverlay(target: Element | null): boolean {
  return !SURFACES.some((surface) => target?.closest(surface));
}
