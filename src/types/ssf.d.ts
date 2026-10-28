declare module "ssf" {
  const SSF: {
    format(format: string, value: unknown, options?: { date1904?: boolean }): string;
  };
  export default SSF;
}
