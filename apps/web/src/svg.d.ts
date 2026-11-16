/** SVG files are imported as their markup (angular.json: `loader: { ".svg": "text" }`). */
declare module "*.svg" {
  const markup: string;
  export default markup;
}
