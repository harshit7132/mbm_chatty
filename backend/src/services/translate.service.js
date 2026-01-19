import axios from 'axios';

// Simple Hindi-English dictionary for common phrases (for demo/testing)
const DICTIONARY = {
    'hi-en': {
        'नमस्ते': 'Hello',
        'धन्यवाद': 'Thank you',
        'कैसे हो': 'How are you',
        'मैं ठीक हूं': 'I am fine',
        'शुभ प्रभात': 'Good morning',
        'शुभ रात्रि': 'Good night',
        'हाँ': 'Yes',
        'नहीं': 'No',
        'कृपया': 'Please',
        'माफ़ करें': 'Sorry',
        'नमस्कार': 'Greetings',
        'अलविदा': 'Goodbye',
        'आपका क्या नाम है': 'What is your name',
        'मेरा नाम': 'My name is',
        'आप कैसे हैं': 'How are you',
        'hi': 'hi',
        'hello': 'hello',
        '/': '/',
        'Hello': 'Hello',
        'Thank you': 'Thank you',
        'Good morning': 'Good morning',
        'What is your name': 'What is your name'
    },
    'en-hi': {
        'Hello': 'नमस्ते',
        'Thank you': 'धन्यवाद',
        'How are you': 'कैसे हो',
        'I am fine': 'मैं ठीक हूं',
        'Good morning': 'शुभ प्रभात',
        'Good night': 'शुभ रात्रि',
        'Yes': 'हाँ',
        'No': 'नहीं',
        'Please': 'कृपया',
        'Sorry': 'माफ़ करें',
        'Greetings': 'नमस्कार',
        'Goodbye': 'अलविदा',
        'What is your name': 'आपका क्या नाम है',
        'My name is': 'मेरा नाम',
        'How are you': 'आप कैसे हैं',
        'hi': 'hi',
        'hello': 'hello',
        '/': '/'
    }
};

/**
 * Simple language detection based on character set
 */
export const detectLanguage = (text) => {
    if (!text || !text.trim()) return 'en';

    // Check for Devanagari script (Hindi)
    const hindiPattern = /[\u0900-\u097F]/;
    if (hindiPattern.test(text)) {
        return 'hi';
    }

    // Default to English
    return 'en';
};

/**
 * Translate text using dictionary first, then fallback to API if needed
 */
export const translate = async (text, fromLang, toLang) => {
    if (fromLang === toLang || !text || !text.trim()) {
        return text;
    }

    const dictKey = `${fromLang}-${toLang}`;
    const trimmedText = text.trim();

    // Check dictionary first (instant, no API call)
    if (DICTIONARY[dictKey] && DICTIONARY[dictKey][trimmedText]) {
        const translated = DICTIONARY[dictKey][trimmedText];
        console.log(`📖 Dictionary translation: "${trimmedText}" → "${translated}"`);
        return translated;
    }

    // If not in dictionary, try API (will likely timeout with free APIs)
    console.log(`🔄 Attempting API translation: "${trimmedText}" from ${fromLang} to ${toLang}`);

    try {
        const langPair = `${fromLang}|${toLang}`;
        const response = await axios.get('https://api.mymemory.translated.net/get', {
            params: {
                q: trimmedText,
                langpair: langPair
            },
            timeout: 3000
        });

        if (response.data.responseStatus === 200) {
            const translatedText = response.data.responseData.translatedText;
            console.log(`✅ API translation success: "${translatedText}"`);
            return translatedText;
        }
    } catch (error) {
        console.error('❌ API translation failed:', error.message);
    }

    // Fallback: return original text
    console.log('   Returning original text (no translation available)');
    return text;
};
