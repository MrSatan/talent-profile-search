type Literal = null | boolean | number | string | Literal[] | LiteralObject;
type LiteralObject = { [key: string]: Literal };

class LiteralParser {
  private position = 0;

  constructor(private readonly source: string) {}

  parse(): Literal {
    const result = this.parseValue();
    this.skipWhitespace();
    if (this.position !== this.source.length) {
      throw new Error('Unexpected trailing literal content');
    }
    return result;
  }

  private parseValue(): Literal {
    this.skipWhitespace();
    const character = this.source[this.position];

    if (character === '[' || character === '(') {
      return this.parseArray(character === '[' ? ']' : ')');
    }
    if (character === '{') {
      return this.parseObject();
    }
    if (character === "'" || character === '"') {
      return this.parseString(character);
    }
    if (this.consumeWord('None') || this.consumeWord('null')) {
      return null;
    }
    if (this.consumeWord('True') || this.consumeWord('true')) {
      return true;
    }
    if (this.consumeWord('False') || this.consumeWord('false')) {
      return false;
    }
    return this.parseNumber();
  }

  private parseArray(closing: ']' | ')'): Literal[] {
    this.position += 1;
    const values: Literal[] = [];
    this.skipWhitespace();
    if (this.source[this.position] === closing) {
      this.position += 1;
      return values;
    }

    while (this.position < this.source.length) {
      values.push(this.parseValue());
      this.skipWhitespace();
      const next = this.source[this.position];
      if (next === closing) {
        this.position += 1;
        return values;
      }
      if (next !== ',') {
        throw new Error('Expected literal list separator');
      }
      this.position += 1;
      this.skipWhitespace();
      if (this.source[this.position] === closing) {
        this.position += 1;
        return values;
      }
    }
    throw new Error('Unclosed literal list');
  }

  private parseObject(): LiteralObject {
    this.position += 1;
    const result: LiteralObject = {};
    this.skipWhitespace();
    if (this.source[this.position] === '}') {
      this.position += 1;
      return result;
    }

    while (this.position < this.source.length) {
      const key = this.parseValue();
      if (typeof key !== 'string') {
        throw new Error('Literal object keys must be strings');
      }
      this.skipWhitespace();
      if (this.source[this.position] !== ':') {
        throw new Error('Expected literal object separator');
      }
      this.position += 1;
      result[key] = this.parseValue();
      this.skipWhitespace();
      const next = this.source[this.position];
      if (next === '}') {
        this.position += 1;
        return result;
      }
      if (next !== ',') {
        throw new Error('Expected literal object item separator');
      }
      this.position += 1;
      this.skipWhitespace();
      if (this.source[this.position] === '}') {
        this.position += 1;
        return result;
      }
    }
    throw new Error('Unclosed literal object');
  }

  private parseString(quote: string): string {
    this.position += 1;
    let result = '';

    while (this.position < this.source.length) {
      const character = this.source[this.position];
      if (character === '\\') {
        result += this.parseEscape();
        continue;
      }
      if (character === quote) {
        const next = this.nextNonWhitespace(this.position + 1);
        if (next === undefined || ',:]} )'.replace(' ', '').includes(next)) {
          this.position += 1;
          return result;
        }
      }
      result += character;
      this.position += 1;
    }
    throw new Error('Unclosed literal string');
  }

  private parseEscape(): string {
    this.position += 1;
    const escaped = this.source[this.position];
    if (escaped === undefined) {
      throw new Error('Incomplete literal escape');
    }
    this.position += 1;
    const replacements: Record<string, string> = {
      '\\': '\\',
      "'": "'",
      '"': '"',
      n: '\n',
      r: '\r',
      t: '\t',
      b: '\b',
      f: '\f',
    };
    if (escaped === 'u') {
      const digits = this.source.slice(this.position, this.position + 4);
      if (!/^[0-9a-f]{4}$/iu.test(digits)) {
        throw new Error('Invalid unicode literal escape');
      }
      this.position += 4;
      return String.fromCodePoint(Number.parseInt(digits, 16));
    }
    return replacements[escaped] ?? escaped;
  }

  private parseNumber(): number {
    const remainder = this.source.slice(this.position);
    const match = remainder.match(/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/iu);
    if (!match) {
      throw new Error('Unsupported literal token');
    }
    this.position += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) {
      throw new Error('Non-finite literal number');
    }
    return value;
  }

  private consumeWord(word: string): boolean {
    if (
      this.source.slice(this.position, this.position + word.length) !== word
    ) {
      return false;
    }
    const next = this.source[this.position + word.length];
    if (next && /[A-Za-z0-9_]/u.test(next)) {
      return false;
    }
    this.position += word.length;
    return true;
  }

  private skipWhitespace(): void {
    while (/\s/u.test(this.source[this.position] ?? '')) {
      this.position += 1;
    }
  }

  private nextNonWhitespace(start: number): string | undefined {
    for (let index = start; index < this.source.length; index += 1) {
      const character = this.source[index];
      if (character && !/\s/u.test(character)) {
        return character;
      }
    }
    return undefined;
  }
}

export function parsePythonLiteral(value: unknown): Literal | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null;
  }
  try {
    return new LiteralParser(value.trim()).parse();
  } catch {
    return null;
  }
}

export function isLiteralObject(value: unknown): value is LiteralObject {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
