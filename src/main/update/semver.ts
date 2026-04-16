/**
 * 경량 semver 비교. 의존성 추가 없이 x.y.z(-prerelease) 만 지원.
 *
 * 반환: a<b → -1, a==b → 0, a>b → 1
 */

export function compareSemver(a: string, b: string): number {
  const [ax, ap] = splitPre(a);
  const [bx, bp] = splitPre(b);
  const xs = ax.split('.').map(toInt);
  const ys = bx.split('.').map(toInt);
  for (let i = 0; i < 3; i++) {
    const d = (xs[i] ?? 0) - (ys[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  // prerelease: 존재하면 더 낮은 우선순위 (0.2.0-beta < 0.2.0)
  if (ap && !bp) return -1;
  if (!ap && bp) return 1;
  if (ap && bp) return ap < bp ? -1 : ap > bp ? 1 : 0;
  return 0;
}

function splitPre(v: string): [string, string | null] {
  const i = v.indexOf('-');
  if (i < 0) return [v, null];
  return [v.slice(0, i), v.slice(i + 1)];
}

function toInt(s: string): number {
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}

export function isBelow(current: string, minimum: string): boolean {
  return compareSemver(current, minimum) < 0;
}
