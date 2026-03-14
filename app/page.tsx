import fs from 'fs';
import path from 'path';
import ClientDashboard from './components/ClientDashboard';
import WeekendRedirect from './components/WeekendRedirect';
import { StoredRateData } from '@/lib/signals';

async function getData(): Promise<StoredRateData[]> {
  const filePath = path.join(process.cwd(), 'public', 'data', 'exchange_rates.json');
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export default async function Home() {
  const data = await getData();

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <WeekendRedirect />
      {/* 헤더 */}
      <header className="border-b border-zinc-800 bg-zinc-900/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💱</span>
            <div>
              <h1 className="font-black text-lg leading-none">FX Signal</h1>
              <p className="text-xs text-zinc-500">환율 매수/매도 기술적 분석</p>
            </div>
          </div>
          {data.length > 0 && (
            <div className="text-xs text-zinc-600">
              마지막 업데이트:{' '}
              {new Date(data[0].updatedAt).toLocaleString('ko-KR', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })}
            </div>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {data.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <div className="text-5xl">📭</div>
            <p className="text-zinc-400 text-center">
              아직 데이터가 없습니다.<br />
              <code className="text-zinc-300 bg-zinc-800 px-2 py-0.5 rounded text-sm">
                npm run data:update
              </code>
              를 실행해 데이터를 수집하세요.
            </p>
          </div>
        ) : (
          <ClientDashboard data={data} />
        )}
      </div>
    </main>
  );
}
