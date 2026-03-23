import fs from 'fs';
import path from 'path';
import ClientDashboard from './components/ClientDashboard';
import WeekendGate from './components/WeekendGate';
import DisclaimerModal from './components/DisclaimerModal';
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
  const lastUpdated = process.env.NEXT_PUBLIC_BUILD_TIME;

  return (
    <WeekendGate>
      <DisclaimerModal />
      <main className="min-h-screen bg-zinc-950 text-white">
        {/* 면책 배너 */}
        <div className="bg-amber-950/40 border-b border-amber-800/30 px-4 py-1.5 text-center">
          <p className="text-[11px] text-amber-400/80">
            본 서비스는 투자자문업 미등록 기술적 분석 정보 제공 서비스입니다. 투자 권유가 아니며 투자 손실의 책임은 본인에게 있습니다.
          </p>
        </div>
        {/* 헤더 */}
        <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            {/* 워드마크 로고 */}
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/10 border border-white/10">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M3 11 L8 5 L13 11" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3 5 L8 11 L13 5" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.5"/>
                </svg>
              </div>
              <div>
                <span className="font-bold text-white text-sm tracking-tight">FX Signal</span>
                <span className="hidden sm:inline text-zinc-600 text-xs ml-2">환율 기술적 분석</span>
              </div>
            </div>

            {lastUpdated && (
              <div className="text-xs text-zinc-600">
                업데이트{' '}
                <span className="text-zinc-500">
                  {new Date(lastUpdated).toLocaleString('ko-KR', {
                    timeZone: 'Asia/Seoul',
                    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                  })}
                </span>
              </div>
            )}
          </div>
        </header>

        <div className="max-w-6xl mx-auto px-4 py-6">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 gap-4">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-2xl">
                📭
              </div>
              <p className="text-zinc-500 text-sm text-center">
                아직 데이터가 없습니다.
                <br />
                <code className="text-zinc-400 bg-zinc-900 px-2 py-0.5 rounded text-xs mt-1 inline-block">
                  npm run data:update
                </code>
              </p>
            </div>
          ) : (
            <ClientDashboard data={data} />
          )}
        </div>
      </main>
    </WeekendGate>
  );
}
