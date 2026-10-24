export const LANGS = [
  { id: 'en', label: 'English', short: 'EN', script: 'en', mode: 'native' },
  { id: 'te', label: 'తెలుగు', short: 'తె', script: 'te', mode: 'native' },
  { id: 'ph', label: 'తెలుగు · phonetic', short: 'తె·ph', script: 'te', mode: 'phonetic' },
  { id: 'hi', label: 'हिन्दी', short: 'हि', script: 'hi', mode: 'native' },
  { id: 'hph', label: 'हिन्दी · phonetic', short: 'हि·ph', script: 'hi', mode: 'phonetic' }
];
const r = (s) => s.split(' ');
export const EN_ROWS = [r('q w e r t y u i o p'), r('a s d f g h j k l'), r('z x c v b n m')];
export const SYM = {
  sym1: [r('1 2 3 4 5 6 7 8 9 0'), r('@ # ₹ _ & - + ( ) /'), r('* " \' : ; ! ?')],
  sym2: [r('~ ` | • √ π ÷ × ¶ ∆'), r('£ € $ ¢ ^ ° = { } \\'), r('© ® ™ ✓ [ ] < >')]
};
export const TE_CONS = [r('క ఖ గ ఘ ఙ చ ఛ జ ఝ ఞ'), r('ట ఠ డ ఢ ణ త థ ద ధ న'), r('ప ఫ బ భ మ య ర ల వ శ'), r('ష స హ ళ ఱ క్ష జ్ఞ')];
export const TE_VOW = [r('అ ఆ ఇ ఈ ఉ ఊ ఋ ౠ ఎ ఏ'), r('ఐ ఒ ఓ ఔ ం ః ఁ ఽ'), r('ా ి ీ ు ూ ృ ె ే ై'), r('ొ ో ౌ ్ ౄ')]; // rows 3-4 are vowel signs (matras)
export const HI_CONS = [r('क ख ग घ ङ च छ ज झ ञ'), r('ट ठ ड ढ ण त थ द ध न'), r('प फ ब भ म य र ल व श'), r('ष स ह ळ ड़ ढ़ क्ष ज्ञ')];
export const HI_VOW = [r('अ आ इ ई उ ऊ ऋ ए ऐ ओ'), r('औ ं ः ँ ़ ् ऽ ।'), r('ा ि ी ु ू ृ े ै ो ौ'), r('ॅ ॉ ॄ ॑ ॒')];
export const EMOJI = [
  { icon: '😀', name: 'Smileys', list: r('😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😎 🤩 🥳 😢 😭 😡 😴 🤔 🙄 😬 🤗 😱 🥺 😌') },
  { icon: '👍', name: 'Gestures', list: r('👍 👎 👏 🙌 🙏 💪 ✌️ 🤝 👋 👌 🤞 ☝️ 👆 👇 👉 👈 ✍️ 🤙 🫶 🙋 💁 🤷 🙆 🙇') },
  { icon: '❤️', name: 'Hearts and symbols', list: r('❤️ 🧡 💛 💚 💙 💜 🖤 🤍 💔 ✨ ⭐ 🌟 💯 ✅ ❌ ⚠️ ❓ ❗ ➕ ➖ ✔️ 🔥 💥 🎯') },
  { icon: '🎉', name: 'Celebration', list: r('🎉 🎊 🎂 🎁 🎈 🪔 🎆 🎇 🥂 🍾 🏆 🥇 🎀 💐 🌹 🌸 🌼 🪷 🔔 🎶 🎵 📣') },
  { icon: '🍕', name: 'Food', list: r('🍎 🍌 🍇 🍉 🍓 🥭 🍕 🍔 🍟 🍗 🍚 🍛 🥘 🍜 🍰 🍩 🍪 ☕ 🍵 🥤 🍬 🥥 🌶️ 🍽️') },
  { icon: '📱', name: 'Objects', list: r('📱 💻 🖨️ 🖼️ 🎨 🖌️ ✏️ 📝 📄 📌 📎 ✂️ 📏 🔍 💡 🔒 📦 🚚 🏷️ 🧾 💰 📅 ⏰ 🏠') }
];
