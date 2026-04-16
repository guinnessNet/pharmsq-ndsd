/**
 * file callback emitter — no-op.
 *
 * runner 가 항상 %LOCALAPPDATA%\OpenPharm\NDSD\results\{jobId}.json 을 쓰므로
 * file callback 은 사실상 "아무 외부 채널로도 보내지 않음, 결과 파일만 쓴다"의 의미다.
 * 추후 임의 경로(filePath) 지원이 필요하면 여기서 확장한다.
 */

export async function emitFile(): Promise<void> {
  // runner 의 writeResult 가 이미 처리.
}
