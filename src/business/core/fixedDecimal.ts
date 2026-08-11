export type FixedDecimal = string & {
  readonly __fixedDecimal: unique symbol;
};

interface ParsedDecimal {
  coefficient: bigint;
  scale: number;
}

const PLAIN_DECIMAL = /^-?\d+(?:\.\d+)?$/;

function assertScale(scale: number): void {
  if (!Number.isSafeInteger(scale) || scale < 0)
    throw new Error("小数位数无效");
}

function powerOfTen(scale: number): bigint {
  assertScale(scale);
  return 10n ** BigInt(scale);
}

function parse(value: FixedDecimal | string): ParsedDecimal {
  if (!PLAIN_DECIMAL.test(value)) throw new Error("十进制格式无效");
  const negative = value.startsWith("-");
  const unsigned = negative ? value.slice(1) : value;
  const [integer, fraction = ""] = unsigned.split(".");
  return normalize({
    coefficient: BigInt(`${negative ? "-" : ""}${integer}${fraction}`),
    scale: fraction.length,
  });
}

function normalize(value: ParsedDecimal): ParsedDecimal {
  let { coefficient, scale } = value;
  if (coefficient === 0n) return { coefficient: 0n, scale: 0 };
  while (scale > 0 && coefficient % 10n === 0n) {
    coefficient /= 10n;
    scale -= 1;
  }
  return { coefficient, scale };
}

function serialize(value: ParsedDecimal): FixedDecimal {
  const normalized = normalize(value);
  if (normalized.coefficient === 0n) return "0" as FixedDecimal;
  const negative = normalized.coefficient < 0n;
  const digits = (
    negative ? -normalized.coefficient : normalized.coefficient
  ).toString();
  const body =
    normalized.scale === 0
      ? digits
      : digits.length <= normalized.scale
        ? `0.${"0".repeat(normalized.scale - digits.length)}${digits}`
        : `${digits.slice(0, -normalized.scale)}.${digits.slice(-normalized.scale)}`;
  return `${negative ? "-" : ""}${body}` as FixedDecimal;
}

function align(
  left: ParsedDecimal,
  right: ParsedDecimal,
): [bigint, bigint, number] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * powerOfTen(scale - left.scale),
    right.coefficient * powerOfTen(scale - right.scale),
    scale,
  ];
}

function roundedRational(
  numerator: bigint,
  denominator: bigint,
  scale: number,
): FixedDecimal {
  assertScale(scale);
  if (denominator === 0n) throw new Error("除数不能为零");
  if (denominator < 0n) {
    numerator = -numerator;
    denominator = -denominator;
  }
  const negative = numerator < 0n;
  const magnitude = negative ? -numerator : numerator;
  const scaled = magnitude * powerOfTen(scale);
  let quotient = scaled / denominator;
  const remainder = scaled % denominator;
  if (remainder * 2n >= denominator) quotient += 1n;
  return serialize({ coefficient: negative ? -quotient : quotient, scale });
}

export function fixedDecimal(input: string): FixedDecimal {
  return serialize(parse(input));
}

export function addFixedDecimal(
  left: FixedDecimal,
  right: FixedDecimal,
): FixedDecimal {
  const [leftCoefficient, rightCoefficient, scale] = align(
    parse(left),
    parse(right),
  );
  return serialize({ coefficient: leftCoefficient + rightCoefficient, scale });
}

export function subtractFixedDecimal(
  left: FixedDecimal,
  right: FixedDecimal,
): FixedDecimal {
  const [leftCoefficient, rightCoefficient, scale] = align(
    parse(left),
    parse(right),
  );
  return serialize({ coefficient: leftCoefficient - rightCoefficient, scale });
}

export function multiplyFixedDecimal(
  left: FixedDecimal,
  right: FixedDecimal,
): FixedDecimal {
  const leftValue = parse(left);
  const rightValue = parse(right);
  return serialize({
    coefficient: leftValue.coefficient * rightValue.coefficient,
    scale: leftValue.scale + rightValue.scale,
  });
}

export function divideFixedDecimal(
  dividend: FixedDecimal,
  divisor: FixedDecimal,
  displayScale: number,
): FixedDecimal {
  const left = parse(dividend);
  const right = parse(divisor);
  if (right.coefficient === 0n) throw new Error("除数不能为零");
  return roundedRational(
    left.coefficient * powerOfTen(right.scale),
    right.coefficient * powerOfTen(left.scale),
    displayScale,
  );
}

export function compareFixedDecimal(
  left: FixedDecimal,
  right: FixedDecimal,
): -1 | 0 | 1 {
  const [leftCoefficient, rightCoefficient] = align(parse(left), parse(right));
  return leftCoefficient < rightCoefficient
    ? -1
    : leftCoefficient > rightCoefficient
      ? 1
      : 0;
}

export function absFixedDecimal(value: FixedDecimal): FixedDecimal {
  const parsed = parse(value);
  return serialize({
    ...parsed,
    coefficient:
      parsed.coefficient < 0n ? -parsed.coefficient : parsed.coefficient,
  });
}

export function roundHalfUp(
  value: FixedDecimal,
  displayScale: number,
): FixedDecimal {
  assertScale(displayScale);
  const parsed = parse(value);
  if (parsed.scale <= displayScale) return serialize(parsed);
  return roundedRational(
    parsed.coefficient,
    powerOfTen(parsed.scale),
    displayScale,
  );
}

export function formatFixedDecimal(
  value: FixedDecimal,
  displayScale: number,
): string {
  assertScale(displayScale);
  const rounded = roundHalfUp(value, displayScale);
  if (displayScale === 0) return rounded;
  const [integer, fraction = ""] = rounded.split(".");
  return `${integer}.${fraction.padEnd(displayScale, "0")}`;
}

export function percentageChange(
  current: FixedDecimal,
  baseline: FixedDecimal,
  displayScale: number,
): FixedDecimal {
  const currentValue = parse(current);
  const baselineValue = parse(baseline);
  if (baselineValue.coefficient === 0n) throw new Error("基期不能为零");
  const commonScale = Math.max(currentValue.scale, baselineValue.scale);
  const currentCoefficient =
    currentValue.coefficient * powerOfTen(commonScale - currentValue.scale);
  const baselineCoefficient =
    baselineValue.coefficient * powerOfTen(commonScale - baselineValue.scale);
  return roundedRational(
    (currentCoefficient - baselineCoefficient) * 100n,
    baselineCoefficient,
    displayScale,
  );
}

function compareRootToRational(
  ratioNumerator: bigint,
  ratioDenominator: bigint,
  years: number,
  thresholdNumerator: bigint,
  thresholdDenominator: bigint,
): -1 | 0 | 1 {
  if (thresholdNumerator <= 0n) return 1;
  const left = ratioNumerator * thresholdDenominator ** BigInt(years);
  const right = ratioDenominator * thresholdNumerator ** BigInt(years);
  return left < right ? -1 : left > right ? 1 : 0;
}

function floorScaledRoot(
  ratioNumerator: bigint,
  ratioDenominator: bigint,
  years: number,
  decimalScale: number,
): bigint {
  const scale = powerOfTen(decimalScale);
  const target = ratioNumerator * scale ** BigInt(years);
  const exponent = BigInt(years);
  let low = 0n;
  let high = scale;
  while (high ** exponent * ratioDenominator <= target) high *= 2n;
  while (low + 1n < high) {
    const middle = (low + high) / 2n;
    if (middle ** exponent * ratioDenominator <= target) low = middle;
    else high = middle;
  }
  return low;
}

function cagrCandidate(
  rootFloor: bigint,
  rootScale: number,
  displayScale: number,
): bigint {
  const denominator = powerOfTen(rootScale);
  const numerator = (rootFloor - denominator) * 100n;
  const rounded = parse(roundedRational(numerator, denominator, displayScale));
  return rounded.coefficient * powerOfTen(displayScale - rounded.scale);
}

function candidateIsCertified(
  ratioNumerator: bigint,
  ratioDenominator: bigint,
  years: number,
  coefficient: bigint,
  displayScale: number,
): boolean {
  const scaledHundred = 100n * powerOfTen(displayScale);
  const boundaryDenominator = 2n * scaledHundred;
  const lowerNumerator = 2n * scaledHundred + 2n * coefficient - 1n;
  const upperNumerator = 2n * scaledHundred + 2n * coefficient + 1n;
  const lowerComparison = compareRootToRational(
    ratioNumerator,
    ratioDenominator,
    years,
    lowerNumerator,
    boundaryDenominator,
  );
  const upperComparison = compareRootToRational(
    ratioNumerator,
    ratioDenominator,
    years,
    upperNumerator,
    boundaryDenominator,
  );
  if (coefficient > 0n) return lowerComparison >= 0 && upperComparison < 0;
  if (coefficient < 0n) return lowerComparison > 0 && upperComparison <= 0;
  return lowerComparison > 0 && upperComparison < 0;
}

export function cagrPercent(
  current: FixedDecimal,
  baseline: FixedDecimal,
  years: number,
  displayScale: number,
): FixedDecimal {
  assertScale(displayScale);
  if (!Number.isSafeInteger(years) || years <= 0) throw new Error("年数无效");
  const currentValue = parse(current);
  const baselineValue = parse(baseline);
  if (currentValue.coefficient <= 0n || baselineValue.coefficient <= 0n) {
    throw new Error("复合增长率端点必须为正数");
  }
  const ratioNumerator =
    currentValue.coefficient * powerOfTen(baselineValue.scale);
  const ratioDenominator =
    baselineValue.coefficient * powerOfTen(currentValue.scale);

  // The integer root supplies a candidate; exact power comparisons against both
  // ROUND_HALF_UP boundaries certify it. Precision grows only when the interval
  // still straddles a rounding boundary, so no fixed guard-digit assumption is authoritative.
  for (let precision = displayScale + 8; ; precision += 8) {
    const floor = floorScaledRoot(
      ratioNumerator,
      ratioDenominator,
      years,
      precision,
    );
    const candidate = cagrCandidate(floor, precision, displayScale);
    if (
      candidateIsCertified(
        ratioNumerator,
        ratioDenominator,
        years,
        candidate,
        displayScale,
      )
    ) {
      return serialize({ coefficient: candidate, scale: displayScale });
    }
  }
}
