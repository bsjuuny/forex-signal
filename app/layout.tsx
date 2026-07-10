import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FX Signal | 환율 매수/매도 신호",
  description: "기술적 분석 기반 환율 매수·매도 신호 서비스 (RSI, EMA, MACD, 볼린저밴드)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
