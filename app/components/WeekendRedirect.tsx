'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function WeekendRedirect() {
  const router = useRouter();

  useEffect(() => {
    const day = new Date().getDay(); // 0=일, 6=토
    if (day === 0 || day === 6) {
      router.replace('/weekend');
    }
  }, [router]);

  return null;
}
