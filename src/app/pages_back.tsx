"use client";

import React, { useState, useRef, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Label } from 'recharts';
import { useRouter, usePathname } from 'next/navigation';

type AspectComment = { comment: string; aspect: string };

type AnalysisResult = {
  positive: number;
  negative: number;
  topPositive: AspectComment[];
  topNegative: AspectComment[];
  positiveCount: number;
  negativeCount: number;
  totalCount: number;
  keywords: { keyword: string; count: number; sentiment: string }[];
};

const PIE_COLORS = ['#3b82f6', '#ef4444'];

type KeywordObj = {
  keyword: string;
  sentiment: 'positive' | 'negative';
  count: number;
  reviewIndices: number[];
};

// Utility function to capitalize the first letter
const capitalizeFirst = (str: string) => str.charAt(0).toUpperCase() + str.slice(1);

export default function Home() {
  const router = useRouter();
  const pathname = usePathname();
  const [lang, setLang] = useState<'en' | 'ko'>('en');
  const txt = (en: string, ko: string) => (lang === 'ko' ? ko : en);
  const [input, setInput] = useState('');
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gradientPos, setGradientPos] = useState<{ x: number; y: number } | null>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [selectedReviews, setSelectedReviews] = useState<string[]>([]);
  const [selectedSentiment, setSelectedSentiment] = useState<'positive' | 'negative' | null>(null);
  const [reviews, setReviews] = useState<string[]>([]);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const langOptions = [
    { value: 'en', label: 'English', icon: '🇺🇸' },
    { value: 'ko', label: '한국어', icon: '🇰🇷' },
  ];

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    const reviewsArr = input
      .split('\n')
      .map((r) => r.trim())
      .filter((r) => r.length > 0);
    setReviews(reviewsArr);
    if (reviewsArr.length === 0) {
      setError('No reviews found.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviews: reviewsArr, locale: lang }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unknown error');
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze reviews.');
    } finally {
      setLoading(false);
    }
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(file.name);
      // TODO: Parse CSV and setInput
    }
  };

  const handleBack = () => {
    setResult(null);
    setError(null);
    setInput('');
    setFileName('');
  };

  const gradientStyle = gradientPos && titleRef.current
    ? {
        background: `radial-gradient(circle at ${gradientPos.x}px ${gradientPos.y}px, #a5b4fc 0%, #f472b6 40%, #fff 70%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        transition: 'background 0.2s',
      }
    : {};

  // Handler for keyword click
  const handleKeywordClick = (keywordObj: KeywordObj) => {
    if (!result || !result.keywords || !Array.isArray(result.keywords)) return;
    if (!keywordObj.reviewIndices || !Array.isArray(keywordObj.reviewIndices)) return;
    const reviewsToShow = keywordObj.reviewIndices.map((idx: number) => reviews[idx]).filter(Boolean);
    setSelectedKeyword(keywordObj.keyword);
    setSelectedReviews(reviewsToShow);
    setSelectedSentiment(keywordObj.sentiment);
    setModalOpen(true);
  };

  // Close modal on ESC key
  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  // Language selection handler
  const handleLocaleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLocale = e.target.value;
    const segments = pathname.split('/');
    segments[1] = newLocale;
    router.push(segments.join('/'));
  };

  return (
    <>
      <div className="w-full flex justify-end p-4 relative z-20">
        <div className="relative inline-block text-left">
          <button
            type="button"
            className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
            onClick={() => setLangMenuOpen((v) => !v)}
            aria-haspopup="listbox"
            aria-expanded={langMenuOpen}
          >
            <span className="text-xl">{langOptions.find(o => o.value === lang)?.icon}</span>
            <span className="font-medium">{langOptions.find(o => o.value === lang)?.label}</span>
            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
          {langMenuOpen && (
            <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded-lg shadow-lg z-30 animate-fadeInScale">
              <ul className="py-1" role="listbox">
                {langOptions.map(option => (
                  <li
                    key={option.value}
                    className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-blue-50 transition text-gray-800 ${lang === option.value ? 'font-bold bg-blue-100' : ''}`}
                    onClick={() => { setLang(option.value as 'en' | 'ko'); setLangMenuOpen(false); }}
                    role="option"
                    aria-selected={lang === option.value}
                  >
                    <span className="text-xl">{option.icon}</span>
                    <span>{option.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
      <div className="min-h-0 bg-white flex flex-col items-center font-sans">
        {/* Upper Section: Only show when not displaying analysis results */}
        {!result && (
          <div className="pt-0 flex flex-col items-center justify-center min-h-[10vh]">
            <h1 className="text-6xl font-extrabold mb-3 tracking-tight bg-gradient-to-r from-blue-600 via-purple-500 to-pink-500 bg-clip-text text-transparent">
              {txt('Review your customer review', '고객후기 자동분석 AI')}
            </h1>
            <div className="text-center max-w-2xl">
              <div className="text-2xl font-bold mb-1 text-gray-900">{txt('Find signals among hundreds of reviews with AI.', '수백개의 리뷰 속에서 헤엄치고 있는 고객의 목소리를 분석해보세요')}</div>
              <div className="text-gray-500 text-lg mb-5 font-normal">
                {txt("When it comes to customer reviews, it's not about feeling - it's about data.", "더 이상 느낌을 믿지 마세요. 데이터를 보세요")}
              </div>
            </div>
          </div>
        )}
        <div className="flex flex-col md:flex-row gap-4 w-full max-w-6xl mt-2">
          {/* Input Card */}
          {!result && (
            <div className="relative mx-auto max-w-2xl w-full transition-all duration-150 hover:shadow-xl hover:scale-[1.02] p-[1px] rounded-2xl bg-gradient-to-r from-blue-500 via-blue-100 to-blue-700 animate-gradient-x">
              <div className="bg-white p-8 rounded-[1rem] shadow-lg flex flex-col gap-2">
                <h2 className="font-semibold text-lg mb-1">{txt('Paste reviews or Upload CSV', '리뷰 입력 or CSV 파일 업로드')}</h2>
                <textarea
                  className="w-full h-50 border border-gray-200 rounded-lg p-4 mb-3 focus:outline-blue-400 resize-none text-lg"
                  placeholder={txt('Paste reviews here..', '여기에 리뷰를 복사해주세요 :)')}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  disabled={loading}
                />
                <div className="flex items-center gap-3 mb-2">
                  <button
                    type="button"
                    className="px-4 py-2 bg-gray-100 rounded-lg border border-gray-300 hover:bg-gray-200 transition text-sm font-medium"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={loading}
                  >
                    {fileName ? txt('Change file', '파일 바꾸기') : txt('Select file', '파일 선택')}
                  </button>
                  <span className="text-sm text-gray-500">{fileName ? fileName : txt('No file selected', '선택된 파일 없음')}</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFile}
                    className="hidden"
                    disabled={loading}
                  />
                </div>
                <button
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold transition mt-2 w-50 mx-auto flex items-center justify-center gap-2"
                  onClick={handleAnalyze}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-blue-400 rounded-full animate-spin"></span>
                      {txt('Analyzing..', '분석 중')}
                    </>
                  ) : (
                    txt('Analyze', '분석하기')
                  )}
                </button>
                {error && <div className="text-red-600 mt-2 text-sm">{error}</div>}
              </div>
            </div>
          )}
          {/* Analysis Section */}
          {result && (
            <div className="w-full max-w-6xl mx-auto">
              <div className="pt-5 mt-1 grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
                {/* Sentiment Ratio Card */}
                <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col items-center justify-center h-full min-h-[340px] text-center">
                  <h2 className="font-bold text-xl mb-4">{txt('Review Sentiment ratio', '리뷰 감정 비율')}</h2>
                  <span className="block text-xl font-bold text-gray-700 mb-2">
                    {lang === 'ko' ? `총 ${result.totalCount}개 리뷰` : `Total: ${result.totalCount} reviews`}
                  </span>
                  <ResponsiveContainer width={260} height={260}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Negative', value: result.negative },
                          { name: 'Positive', value: result.positive },
                        ]}
                        dataKey="value"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        startAngle={90}
                        endAngle={-270}
                        labelLine={false}
                      >
                        {['#ef4444', '#3b82f6'].map((color, idx) => <Cell key={color} fill={color} />)}
                        <Label
                          value={lang === 'ko' ? `${Math.round(result.positive)}% 긍정` : `${Math.round(result.positive)}% Positive`}
                          position="center"
                          style={{ fontSize: 28, fontWeight: 700, fill: '#222' }}
                        />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col items-center mt-4">
                    <div className="flex gap-8 items-end justify-center">
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="inline-block w-4 h-4 rounded-full" style={{ background: '#3b82f6' }}></span>
                          <span className="text-black font-medium">{txt('Positive', '긍정 리뷰')}</span>
                        </div>
                        <span className="text-black text-2xl font-bold">{result.positiveCount}</span>
                      </div>
                      <div className="flex flex-col items-center">
                        <div className="flex items-center gap-1 mb-1">
                          <span className="inline-block w-4 h-4 rounded-full" style={{ background: '#ef4444' }}></span>
                          <span className="text-black font-medium">{txt('Negative', '부정 리뷰')}</span>
                        </div>
                        <span className="text-black text-2xl font-bold">{result.negativeCount}</span>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Positive Keywords Card */}
                {(() => {
                  const positiveKeywords = result.keywords.filter(k => k.sentiment === 'positive');
                  const totalPositiveKeywordCount = positiveKeywords.reduce((sum, k) => sum + k.count, 0);
                  const sortedPositive = [...positiveKeywords].sort((a, b) => b.count - a.count);
                  return (
                    <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col min-h-[340px] h-full">
                      <h3 className="text-2xl font-bold mb-3 flex items-center">
                        <span className="inline-block w-5 h-5 rounded-full mr-2" style={{ background: '#3b82f6' }}></span>
                        {txt('Positive Keywords', '긍정 키워드')}
                      </h3>
                      <ul className="flex-1">
                        {sortedPositive.map((k, i) => (
                          <li key={k.keyword} className="flex justify-between items-center py-2 border-b last:border-b-0">
                            <button
                              className="text-left font-semibold text-gray-800 hover:text-blue-600 transition-colors duration-200 focus:outline-none"
                              onClick={() => handleKeywordClick(k as KeywordObj)}
                            >
                              {capitalizeFirst(k.keyword)}
                            </button>
                            <span className="font-bold text-blue-500">{totalPositiveKeywordCount > 0 ? Math.round((k.count / totalPositiveKeywordCount) * 100) : 0}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
                {/* Negative Keywords Card */}
                {(() => {
                  const negativeKeywords = result.keywords.filter(k => k.sentiment === 'negative');
                  const totalNegativeKeywordCount = negativeKeywords.reduce((sum, k) => sum + k.count, 0);
                  const sortedNegative = [...negativeKeywords].sort((a, b) => b.count - a.count);
                  return (
                    <div className="bg-white rounded-2xl shadow-lg p-8 flex flex-col min-h-[340px] h-full">
                      <h3 className="text-2xl font-bold mb-3 flex items-center">
                        <span className="inline-block w-5 h-5 rounded-full mr-2" style={{ background: '#ef4444' }}></span>
                        {txt('Negative Keywords', '부정 키워드')}
                      </h3>
                      <ul className="flex-1">
                        {sortedNegative.map((k, i) => (
                          <li key={k.keyword} className="flex justify-between items-center py-2 border-b last:border-b-0">
                            <button
                              className="text-left font-semibold text-gray-800 hover:text-red-600 transition-colors duration-200 focus:outline-none"
                              onClick={() => handleKeywordClick(k as KeywordObj)}
                            >
                              {capitalizeFirst(k.keyword)}
                            </button>
                            <span className="font-bold text-red-500">{totalNegativeKeywordCount > 0 ? Math.round((k.count / totalNegativeKeywordCount) * 100) : 0}%</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })()}
              </div>
              <div className="flex justify-center mt-15">
                <button
                  className="px-8 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition"
                  onClick={handleBack}
                >
                  {txt('back', '뒤로가기')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal Popup for Related Reviews */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-md transition-opacity duration-500"
          onClick={e => {
            // Only close if the overlay itself is clicked, not the modal content
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl p-8 max-w-lg w-full relative animate-fadeInScale">
            <button
              className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl font-bold focus:outline-none"
              onClick={() => setModalOpen(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <h4 className={`text-xl font-bold mb-4 ${selectedSentiment === 'negative' ? 'text-red-600' : 'text-blue-700'}`}>{selectedKeyword}</h4>
            <ul className="space-y-3 max-h-80 overflow-y-auto pr-2">
              {selectedReviews.length > 0 ? (
                selectedReviews.map((review, idx) => (
                  <li key={idx} className="bg-gray-50 rounded-lg px-4 py-3 shadow-sm border border-gray-100">
                    {review}
                  </li>
                ))
              ) : (
                <li className="text-gray-500">{txt('no_related_reviews', '관련된 리뷰 없음')}</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* Modal animation */}
      <style jsx global>{`
        @keyframes fadeInScale {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-fadeInScale {
          animation: fadeInScale 0.18s cubic-bezier(0.4,0,0.2,1);
        }
      `}</style>
    </>
  );
}
