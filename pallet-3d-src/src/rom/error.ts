export class RomError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RomError";
  }
}
