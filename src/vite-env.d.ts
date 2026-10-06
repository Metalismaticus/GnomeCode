/* Модули-ресурсы, которые импортирует интерфейс (Vite отдаёт их адресами):
   знак логотипа — маскот владельца из docs/refs (Sidebar.tsx). */

declare module "*.png" {
  const src: string;
  export default src;
}
