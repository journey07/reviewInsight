import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  const { reviews, locale } = await req.json();
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OpenAI API key not set.' }, { status: 500 });
  }
  if (!reviews || !Array.isArray(reviews) || reviews.length === 0) {
    return NextResponse.json({ error: 'No reviews provided.' }, { status: 400 });
  }

  // Compose prompt for sentiment analysis and keyword extraction
  const promptEn = `
Analyze the following reviews and return only JSON in this format (no explanation, no greeting, no code block):

{
  "totalCount": number,
  "positiveCount": number,
  "negativeCount": number,
  "positive": %, // percentage of positive reviews
  "negative": %, // percentage of negative reviews
  "keywords": [
    { "keyword": "...", "sentiment": "positive" | "negative", "count": number, "reviewIndices": [number, ...], "aspect": "..." }
  ]
}

Instructions:
1. For each review, decide if it is positive or negative.
2. Count the total number of reviews, and the number of positive and negative reviews.
3. Extract concise, meaningful aspects or features from the reviews as keywords. The keywords should be more specific than just "quality" or "service", but not as detailed as "beautiful color" or "nice wood scent". Examples of good keywords: "build quality", "delivery speed", "assembly instructions", "customer service", "durability", "design", "comfort", "price". Avoid both overly broad and overly detailed keywords.
4. Group all similar or related detailed keywords under a single concise aspect. Return the aspect as the keyword, and count how many reviews mention each aspect.
5. Remove stopwords and filter out generic or irrelevant terms.
6. For each keyword, also return a 'reviewIndices' array containing the indices (0-based) of reviews that are most related to that keyword.
7. Sort keywords in descending order of frequency within each sentiment group.
8. Return the top keywords for each sentiment in the 'keywords' array, including their sentiment, count, reviewIndices, and aspect.
9. A single review may mention multiple aspects. Extract all relevant keywords from each review.

Reviews list:
${reviews.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;

  if (locale === 'ko') {
    // 1. First AI call: Sentiment classification only
    const sentimentPrompt = `
아래 리뷰들을 각각 읽고, 긍정 또는 부정으로만 분류하세요.
JSON 예시: {"sentiments": ["positive", "negative", ...]}

리뷰 목록:
${reviews.map((r, i) => `${i + 1}. ${r}`).join('\n')}
`;
    let sentiments: string[] = [];
    try {
      const sentimentCompletion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: '당신은 리뷰 감성 분석을 도와주는 한국어 AI 어시스턴트입니다.' },
          { role: 'user', content: sentimentPrompt }
        ],
        temperature: 0.2,
        max_tokens: 512
      });
      const sentimentText = sentimentCompletion.choices[0].message.content || '';
      const sentimentMatch = sentimentText.match(/\{[\s\S]*\}/);
      const sentimentJson = sentimentMatch ? JSON.parse(sentimentMatch[0]) : null;
      if (!sentimentJson || !Array.isArray(sentimentJson.sentiments)) {
        throw new Error('No valid sentiments array in OpenAI response');
      }
      sentiments = sentimentJson.sentiments;
      if (sentiments.length !== reviews.length) {
        throw new Error('Sentiment array length mismatch');
      }
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'OpenAI sentiment step error' }, { status: 500 });
    }

    // 2. Second AI call: Keyword extraction using sentiment info
    const keywordPrompt = `
아래는 각 리뷰의 감성(긍정/부정) 결과입니다. 각 리뷰에서 의미 있는 키워드를 추출하고, 해당 감성에 따라 분류하세요.
JSON 예시:
{
  "totalCount": 전체 리뷰 개수,
  "positiveCount": 긍정 리뷰 개수,
  "negativeCount": 부정 리뷰 개수,
  "positive": %, "negative": %,
  "keywords": [
    { "keyword": "...", "sentiment": "positive"|"negative", "count": 개수, "reviewIndices": [번호, ...], "aspect": "..." }
  ]
}
지침:
- 각 리뷰의 감성(긍정/부정)은 이미 주어졌으니, 그 감성에 따라 키워드를 분류하세요.
- 의미 있는 키워드만 추출하세요. 너무 포괄적이거나 너무 세부적이면 안 됩니다.
- 유사 키워드는 하나로 묶으세요.
- 예시: "고기", "반찬", "환기", "청결", "가격", "A/S", "내구성", "조립 난이도"
- 키워드의 긍정, 부정은 반드시 문장 전체 의미로 판단하세요.
- 각 키워드별로 관련 리뷰 인덱스(0부터 시작)를 'reviewIndices'에 반환하세요.

리뷰 목록:
${reviews.map((r, i) => `${i + 1}. ${r}`).join('\n')}

감성 결과:
${sentiments.map((s, i) => `${i + 1}. ${s}`).join('\n')}
`;
    try {
      const keywordCompletion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: '당신은 키워드 분석을 도와주는 AI 어시스턴트입니다.' },
          { role: 'user', content: keywordPrompt }
        ],
        temperature: 0.3,
        max_tokens: 2048
      });
      const keywordText = keywordCompletion.choices[0].message.content || '';
      const keywordMatch = keywordText.match(/\{[\s\S]*\}/);
      const keywordJson = keywordMatch ? JSON.parse(keywordMatch[0]) : null;
      if (!keywordJson) throw new Error('No JSON in OpenAI keyword response');
      // Ensure positive/negative percentages are always present and valid
      if (typeof keywordJson.positive !== 'number' || isNaN(keywordJson.positive)) {
        keywordJson.positive = keywordJson.totalCount > 0 ? (keywordJson.positiveCount / keywordJson.totalCount) * 100 : 0;
      }
      if (typeof keywordJson.negative !== 'number' || isNaN(keywordJson.negative)) {
        keywordJson.negative = keywordJson.totalCount > 0 ? (keywordJson.negativeCount / keywordJson.totalCount) * 100 : 0;
      }
      return NextResponse.json(keywordJson);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'OpenAI keyword step error' }, { status: 500 });
    }
  } else {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4.1-mini',
        messages: [
          { role: 'system', content: locale === 'ko' ? '당신은 리뷰 감성 분석을 도와주는 한국어 AI 어시스턴트입니다.' : 'You are a helpful assistant for review sentiment analysis.' },
          { role: 'user', content: promptEn }
        ],
        temperature: 0.3,
        max_tokens: 2048
      });
      const text = completion.choices[0].message.content || '';
      // Try to parse JSON from the response
      const match = text.match(/\{[\s\S]*\}/);
      const json = match ? JSON.parse(match[0]) : null;
      if (!json) throw new Error('No JSON in OpenAI response');
      // Ensure positive/negative percentages are always present and valid
      if (typeof json.positive !== 'number' || isNaN(json.positive)) {
        json.positive = json.totalCount > 0 ? (json.positiveCount / json.totalCount) * 100 : 0;
      }
      if (typeof json.negative !== 'number' || isNaN(json.negative)) {
        json.negative = json.totalCount > 0 ? (json.negativeCount / json.totalCount) * 100 : 0;
      }
      return NextResponse.json(json);
    } catch (err: any) {
      return NextResponse.json({ error: err.message || 'OpenAI error' }, { status: 500 });
    }
  }
} 