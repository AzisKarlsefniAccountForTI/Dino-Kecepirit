
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameTheme, Obstacle, Particle } from './types';
import { generateNewTheme } from './services/geminiService';
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";

const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const INITIAL_SPEED = 6;
const SPEED_INCREMENT = 0.001;
const GROUND_Y = 320; 
const DINO_WIDTH = 70; 
const DINO_HEIGHT = 85; 
const OBSTACLE_MIN_GAP = 400;
const THEME_CHANGE_INTERVAL = 300; 
const INVINCIBILITY_DURATION = 6000; 
const QUIZ_CHANCE_INTERVAL = 500; 

interface QuizData {
  question: string;
  options: string[];
  correctIndex: number;
}

const QUIZ_POOL: QuizData[] = [
  {
    question: "Dino ingin memperkenalkan dirinya sebagai profesional TI. Mana kalimat pembuka yang paling sesuai untuk 'Academic & Professional' purpose?",
    options: ["I am Dino and I like games.", "Hello, I am Dino, a software engineering student specializing in web development.", "What's up, I'm Dino the coder.", "My name Dino, IT man."],
    correctIndex: 1
  },
  {
    question: "Dino sedang mengeja (spelling) istilah 'ENCRYPTION' kepada rekan timnya. Huruf ke-4 adalah...",
    options: ["/aɪ/ (I)", "/waɪ/ (Y)", "/r/ (R)", "/p/ (P)"],
    correctIndex: 2
  },
  {
    question: "Dino harus memperbaiki kalimat ini agar menjadi 'Kalimat Efektif': 'The computer, it is very old and it is not working.'",
    options: ["The old computer is broken.", "The computer old is not work.", "Working is not the old computer.", "Very old computer not work."],
    correctIndex: 0
  },
  {
    question: "Dino membaca teks akademik tentang 'Artificial Intelligence'. Dia menemukan kata 'Algorithm'. Berdasarkan konteks TI, apa itu Algorithm?",
    options: ["Sebuah perangkat keras baru.", "Urutan langkah-halangkah logis untuk menyelesaikan masalah.", "Nama merk laptop.", "Kabel untuk menyambungkan internet."],
    correctIndex: 1
  },
  {
    question: "Saat mengikuti webinar global (Reflection), Dino menyadari bahwa Bahasa Inggris penting dalam TI karena...",
    options: ["Agar bisa bermain game luar negeri saja.", "Karena dokumentasi teknologi mayoritas menggunakan Bahasa Inggris.", "Supaya terlihat keren di depan teman.", "Bahasa Inggris tidak penting untuk programmer."],
    correctIndex: 1
  },
  {
    question: "Dino sedang berdiskusi tentang fitur baru. Dino ingin memberikan pendapat. Kalimat mana yang paling profesional?",
    options: ["Listen to me now!", "I think you are wrong.", "In my opinion, we should focus on user security first.", "I don't care, just do it."],
    correctIndex: 2
  },
  {
    question: "Dalam kalimat ilmiah: 'The developer analyzes the system,' kata 'analyzes' berfungsi sebagai...",
    options: ["Noun (Kata benda)", "Adjective (Kata sifat)", "Verb (Kata kerja)", "Adverb (Kata keterangan)"],
    correctIndex: 2
  },
  {
    question: "Dino akan memulai presentasi akademik. Kalimat 'Signposting' mana yang digunakan untuk pindah ke topik berikutnya?",
    options: ["I'm finished with this.", "Next, let's look at the data results.", "Stop looking at that slide.", "I will go home now."],
    correctIndex: 1
  },
  {
    question: "Dino ingin mengirim email lamaran kerja. Apa kalimat penutup (Closing) yang paling formal?",
    options: ["See ya!", "Thanks for everything.", "Sincerely yours, atau Best regards,", "Bye-bye."],
    correctIndex: 2
  },
  {
    question: "Dino diminta membuat ringkasan (summary) artikel ilmiah. Langkah pertama yang benar adalah...",
    options: ["Menyalin seluruh paragraf pertama.", "Membaca cepat (skimming) untuk menemukan ide pokok setiap bagian.", "Menghapus semua gambar dalam artikel.", "Mengubah judul artikel menjadi lebih lucu."],
    correctIndex: 1
  }
];

const updateEnvironmentTool: FunctionDeclaration = {
  name: 'updateEnvironment',
  parameters: {
    type: Type.OBJECT,
    description: 'Update the game theme, colors, and atmosphere based on user request.',
    properties: {
      skyColor: { type: Type.STRING, description: 'Hex color for the sky' },
      dinoColor: { type: Type.STRING, description: 'Hex color for the T-Rex body' },
      groundColor: { type: Type.STRING, description: 'Hex color for the ground line' },
      themeName: { type: Type.STRING, description: 'A short descriptive name for the new theme' },
      cactusColor: { type: Type.STRING, description: 'Hex color for the cacti' }
    },
    required: ['skyColor', 'dinoColor', 'themeName']
  }
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER' | 'QUIZ'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [theme, setTheme] = useState<GameTheme>({
    sky: '#f8fafc',
    ground: '#475569',
    dino: '#166534',
    cactus: '#064e3b',
    particle: '#b45309',
    themeName: 'Campus Morning'
  });
  const [isLoadingTheme, setIsLoadingTheme] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState<'NONE' | 'CORRECT' | 'WRONG'>('NONE');
  const [quizExplanation, setQuizExplanation] = useState<string>("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);
  const [invincibilityTimeLeft, setInvincibilityTimeLeft] = useState(0);
  const isInvincible = invincibilityTimeLeft > 0;
  const canRevive = useRef(true);
  const lastQuizScore = useRef(0);
  const lastQuestionIndex = useRef<number | null>(null);

  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'ai', text: string }[]>([
    { role: 'ai', text: 'ROAR! Dino Kecepirit di sini. Kamu bisa minta aku ganti warna badan, cuaca, atau waktu (pagi/malam) lewat chat ini lho!' }
  ]);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const isTyping = useRef(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dinoY = useRef(GROUND_Y - DINO_HEIGHT);
  const dinoVy = useRef(0);
  const isJumping = useRef(false);
  const obstacles = useRef<Obstacle[]>([]);
  const particles = useRef<Particle[]>([]);
  const gameSpeed = useRef(INITIAL_SPEED);
  const frameId = useRef<number>(0);
  const scoreRef = useRef(0);
  const nextThemeScore = useRef(THEME_CHANGE_INTERVAL);

  useEffect(() => {
    if (invincibilityTimeLeft > 0 && gameState === 'PLAYING') {
      const timer = setInterval(() => {
        setInvincibilityTimeLeft(prev => Math.max(0, prev - 100));
      }, 100);
      return () => clearInterval(timer);
    }
  }, [invincibilityTimeLeft, gameState]);

  const resetGame = () => {
    dinoY.current = GROUND_Y - DINO_HEIGHT;
    dinoVy.current = 0;
    isJumping.current = false;
    obstacles.current = [];
    particles.current = [];
    gameSpeed.current = INITIAL_SPEED;
    scoreRef.current = 0;
    canRevive.current = true;
    setInvincibilityTimeLeft(0);
    setScore(0);
    nextThemeScore.current = THEME_CHANGE_INTERVAL;
    lastQuizScore.current = 0;
    lastQuestionIndex.current = null;
    setQuizFeedback('NONE');
    setQuizExplanation("");
    setSelectedIndex(null);
    setGameState('PLAYING');
  };

  const startQuiz = useCallback(() => {
    if (frameId.current) cancelAnimationFrame(frameId.current);
    
    let randomIdx: number;
    do {
      randomIdx = Math.floor(Math.random() * QUIZ_POOL.length);
    } while (randomIdx === lastQuestionIndex.current && QUIZ_POOL.length > 1);
    
    lastQuestionIndex.current = randomIdx;
    const selectedQuiz = QUIZ_POOL[randomIdx];
    
    const optionsWithMetadata = selectedQuiz.options.map((opt, i) => ({
      text: opt,
      isCorrect: i === selectedQuiz.correctIndex
    }));
    
    for (let i = optionsWithMetadata.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [optionsWithMetadata[i], optionsWithMetadata[j]] = [optionsWithMetadata[j], optionsWithMetadata[i]];
    }
    
    const shuffledOptions = optionsWithMetadata.map(o => o.text);
    const newCorrectIndex = optionsWithMetadata.findIndex(o => o.isCorrect);

    setCurrentQuiz({
      ...selectedQuiz,
      options: shuffledOptions,
      correctIndex: newCorrectIndex
    });
    
    setQuizFeedback('NONE');
    setQuizExplanation("");
    setSelectedIndex(null);
    setGameState('QUIZ');
  }, []);

  const handleQuizAnswer = async (index: number) => {
    if (!currentQuiz || quizFeedback !== 'NONE') return;
    
    setSelectedIndex(index);
    const isCorrect = index === currentQuiz.correctIndex;
    setQuizFeedback(isCorrect ? 'CORRECT' : 'WRONG');
    setIsExplaining(true);
    
    try {
      // Menggunakan gemini-flash-latest untuk respon cepat kuis
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Explain why the answer "${currentQuiz.options[index]}" is ${isCorrect ? 'CORRECT' : 'WRONG'} for the question: "${currentQuiz.question}". Respond as Dino Kecepirit (funny T-Rex) in Indonesian. Max 2 sentences.`;
      const response = await ai.models.generateContent({ 
        model: 'gemini-flash-latest', 
        contents: prompt
      });
      setQuizExplanation(response.text || "Dino capek jelasin.");
    } catch (e) {
      console.error("AI Error:", e);
      setQuizExplanation("Gagal koneksi ke otak purba.");
    } finally {
      setIsExplaining(false);
    }
  };

  const closeQuiz = () => {
    if (quizFeedback === 'CORRECT') {
      setInvincibilityTimeLeft(INVINCIBILITY_DURATION);
      setGameState('PLAYING');
    } else {
      if (!canRevive.current) {
        setGameState('GAMEOVER');
        if (Math.floor(scoreRef.current / 10) > highScore) setHighScore(Math.floor(scoreRef.current / 10));
      } else {
        setGameState('PLAYING'); 
      }
    }
    setCurrentQuiz(null);
    setQuizFeedback('NONE');
    setQuizExplanation("");
    setSelectedIndex(null);
  };

  const handleJump = useCallback(() => {
    if (isTyping.current || gameState === 'QUIZ') return;
    
    if (!isJumping.current && gameState === 'PLAYING') {
      dinoVy.current = JUMP_FORCE;
      isJumping.current = true;
    } else if (gameState === 'GAMEOVER' || gameState === 'START') {
      resetGame();
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'ArrowUp') && !isTyping.current) {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleJump]);

  const updateTheme = async (currentScore: number) => {
    setIsLoadingTheme(true);
    const newTheme = await generateNewTheme(currentScore);
    setTheme(newTheme);
    setIsLoadingTheme(false);
    nextThemeScore.current += THEME_CHANGE_INTERVAL;
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;
    const userText = chatInput;
    setChatMessages(prev => [...prev, { role: 'user', text: userText }]);
    setChatInput("");
    setIsChatLoading(true);

    try {
      // Menggunakan gemini-3-pro-preview untuk logika chat yang lebih berat
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: userText,
        config: {
          systemInstruction: "You are 'Dino Kecepirit', a funny T-Rex TI Expert. You can change the game colors/environment using the updateEnvironment tool if requested. Always respond in Indonesian.",
          tools: [{ functionDeclarations: [updateEnvironmentTool] }]
        }
      });

      if (response.functionCalls && response.functionCalls.length > 0) {
        const fc = response.functionCalls[0];
        if (fc.name === 'updateEnvironment') {
          const args = fc.args as any;
          setTheme(prev => ({
            ...prev,
            sky: args.skyColor || prev.sky,
            dino: args.dinoColor || prev.dino,
            ground: args.groundColor || prev.ground,
            themeName: args.themeName || prev.themeName,
            cactus: args.cactusColor || prev.cactus
          }));
          setChatMessages(prev => [...prev, { role: 'ai', text: `ROAR! Selesai! Aku sudah ubah suasananya jadi "${args.themeName || 'Custom'}". Keren kan?` }]);
        }
      } else {
        setChatMessages(prev => [...prev, { role: 'ai', text: response.text || "GRRR..." }]);
      }
    } catch (e) {
      console.error("AI Error:", e);
      setChatMessages(prev => [...prev, { role: 'ai', text: "Aduh, Dino kebelet, gagal respon." }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const drawDinoBlocks = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, isJumping: boolean, score: number) => {
    const shadowColor = "rgba(0,0,0,0.35)";
    const highlightColor = "rgba(255,255,255,0.25)";
    const bellyColor = "rgba(255,255,255,0.2)";
    const patternsColor = "rgba(255,255,255,0.15)";

    const legAnim = !isJumping && Math.floor(score / 5) % 2 === 0;

    // --- FAR LEG (BACK LEG) ---
    ctx.fillStyle = color;
    ctx.fillRect(x + 20, y + 70, 12, legAnim ? 15 : 10);
    ctx.fillRect(x + 23, y + (legAnim ? 80 : 75), 10, 5);
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x + 20, y + 70, 12, legAnim ? 15 : 10);

    // --- MAIN BODY ---
    ctx.fillStyle = color;
    ctx.fillRect(x + 10, y + 35, 35, 35); 
    
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x + 10, y + 62, 35, 8);
    ctx.fillRect(x + 40, y + 35, 5, 35);

    ctx.fillStyle = bellyColor;
    ctx.fillRect(x + 20, y + 45, 12, 18);

    ctx.fillStyle = patternsColor;
    ctx.fillRect(x + 15, y + 38, 4, 4);
    ctx.fillRect(x + 30, y + 50, 4, 4);
    ctx.fillRect(x + 12, y + 55, 4, 4);

    // --- TAIL ---
    ctx.fillStyle = color;
    ctx.fillRect(x - 5, y + 45, 15, 15);
    ctx.fillRect(x - 12, y + 50, 8, 8);
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x - 5, y + 55, 15, 5);
    ctx.fillRect(x - 12, y + 54, 8, 4);

    // --- NECK ---
    ctx.fillStyle = color;
    ctx.fillRect(x + 35, y + 35, 12, 15);
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x + 44, y + 35, 3, 15);

    // --- HEAD ---
    ctx.fillStyle = color;
    ctx.fillRect(x + 15, y + 5, 54, 35); 
    
    ctx.fillStyle = highlightColor;
    ctx.fillRect(x + 15, y + 5, 54, 6);
    
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x + 15, y + 30, 54, 5);
    ctx.fillRect(x + 64, y + 5, 5, 35);

    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(x + 45, y + 24, 24, 2);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 48, y + 26, 4, 5);
    ctx.fillRect(x + 56, y + 26, 4, 5);
    ctx.fillRect(x + 64, y + 26, 4, 5);

    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x + 62, y + 10, 3, 3);

    ctx.fillStyle = "#fbbf24";
    ctx.fillRect(x + 45, y + 8, 10, 10);
    ctx.fillStyle = "#000000";
    ctx.fillRect(x + 50, y + 11, 4, 4); 
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 50, y + 11, 1, 1);

    // --- ARMS ---
    ctx.fillStyle = color;
    ctx.fillRect(x + 42, y + 45, 14, 7);
    ctx.fillRect(x + 54, y + 49, 4, 4);
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x + 42, y + 50, 14, 2);

    // --- NEAR LEG (FRONT LEG) ---
    ctx.fillStyle = color;
    ctx.fillRect(x + 35, y + 70, 12, legAnim ? 10 : 15);
    ctx.fillRect(x + 38, y + (legAnim ? 75 : 80), 10, 5);
    ctx.fillStyle = highlightColor;
    ctx.fillRect(x + 35, y + 70, 4, legAnim ? 10 : 15);
  };

  const drawCactus = (ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, color: string) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + width / 4, y, width / 2, height);
    ctx.fillStyle = "rgba(0,0,0,0.2)";
    ctx.fillRect(x + width / 4 + 2, y + 5, 4, height - 10);
    ctx.fillStyle = color;
    const armH = 15;
    ctx.fillRect(x, y + height * 0.3, width / 4, 8);
    ctx.fillRect(x, y + height * 0.3 - armH, 8, armH + 8);
    if (height > 50) {
      ctx.fillRect(x + width * 0.75, y + height * 0.5, width / 4, 8);
      ctx.fillRect(x + width - 8, y + height * 0.5 - armH, 8, armH + 8);
    }
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.fillRect(x + width / 2, y + 10, 3, 3);
    ctx.fillRect(x + width / 2 - 4, y + 30, 3, 3);
    ctx.fillRect(x + width / 2 + 5, y + 50, 3, 3);
  };

  const gameLoop = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background & Ground line
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = theme.sky;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = theme.ground;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(canvas.width, GROUND_Y); ctx.stroke();

    // Physics
    dinoVy.current += GRAVITY;
    dinoY.current += dinoVy.current;
    if (dinoY.current > GROUND_Y - DINO_HEIGHT) {
      dinoY.current = GROUND_Y - DINO_HEIGHT;
      dinoVy.current = 0;
      isJumping.current = false;
    }

    // Score & Speed
    scoreRef.current += 1;
    const currentDisplayScore = Math.floor(scoreRef.current / 10);
    setScore(currentDisplayScore);
    gameSpeed.current += SPEED_INCREMENT;

    // AI Theme Change
    if (currentDisplayScore >= nextThemeScore.current && !isLoadingTheme) {
      updateTheme(currentDisplayScore);
    }

    // Random Quiz chance
    if (currentDisplayScore > lastQuizScore.current + QUIZ_CHANCE_INTERVAL && Math.random() < 0.005) {
      lastQuizScore.current = currentDisplayScore;
      startQuiz();
      return; 
    }

    // Spawn Obstacles
    if (obstacles.current.length === 0 || canvas.width - obstacles.current[obstacles.current.length - 1].x > OBSTACLE_MIN_GAP + Math.random() * 400) {
      const h = 30 + Math.random() * 35;
      const w = 35 + Math.random() * 35;
      obstacles.current.push({ id: Date.now() + Math.random(), x: canvas.width, width: w, height: h, type: 'cactus' });
    }

    // Update & Collision
    const dinoRect = { x: 50 + 10, y: dinoY.current + 10, w: 50, h: DINO_HEIGHT - 20 };
    
    obstacles.current.forEach(obs => {
      obs.x -= gameSpeed.current;
      
      if (!isInvincible) {
        if ( dinoRect.x < obs.x + obs.width && dinoRect.x + dinoRect.w > obs.x && dinoRect.y < (GROUND_Y - obs.height) + obs.height && dinoRect.y + dinoRect.h > (GROUND_Y - obs.height) ) {
          if (canRevive.current) { 
            canRevive.current = false; 
            startQuiz(); 
          }
          else { 
            setGameState('GAMEOVER'); 
            if (currentDisplayScore > highScore) setHighScore(currentDisplayScore); 
          }
        }
      }
    });
    obstacles.current = obstacles.current.filter(obs => obs.x + obs.width > -50);

    // Particles (Dust trail)
    if (Math.random() > 0.85 && !isJumping.current) {
       particles.current.push({ id: Math.random(), x: 70, y: dinoY.current + DINO_HEIGHT - 10, vx: -gameSpeed.current * 0.4 - Math.random() * 2, vy: Math.random() * 2, life: 1.0 });
    }
    particles.current.forEach(p => { 
      p.x += p.vx; p.y += p.vy; p.life -= 0.03; 
      ctx.globalAlpha = p.life; 
      ctx.fillStyle = theme.particle;
      ctx.fillRect(p.x, p.y, 4, 4); 
    });
    particles.current = particles.current.filter(p => p.life > 0);
    ctx.globalAlpha = 1.0;

    // Draw Dino
    const dx = 50;
    const dy = dinoY.current;
    if (isInvincible) {
      const pulse = Math.sin(Date.now() / 150);
      const blurSize = 25 + pulse * 10;
      ctx.save();
      ctx.shadowBlur = blurSize;
      ctx.shadowColor = `rgba(251, 191, 36, ${0.6 + pulse * 0.3})`;
      ctx.strokeStyle = '#fbbf24'; 
      ctx.lineWidth = 4; 
      ctx.beginPath();
      ctx.ellipse(dx + 35, dy - 20 + pulse * 5, 25, 6, 0, 0, Math.PI * 2); 
      ctx.stroke();
      drawDinoBlocks(ctx, dx, dy, theme.dino, isJumping.current, scoreRef.current);
      ctx.restore();
    } else {
      drawDinoBlocks(ctx, dx, dy, theme.dino, isJumping.current, scoreRef.current);
    }

    // Draw Cacti
    obstacles.current.forEach(obs => { drawCactus(ctx, obs.x, GROUND_Y - obs.height, obs.width, obs.height, theme.cactus); });

    frameId.current = requestAnimationFrame(gameLoop);
  }, [gameState, theme, highScore, isLoadingTheme, isInvincible, startQuiz]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      frameId.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (frameId.current) cancelAnimationFrame(frameId.current);
    };
  }, [gameState, gameLoop]);

  return (
    <div className="flex flex-col items-center min-h-screen py-8 md:py-16 px-4 relative overflow-x-hidden">
      <div className="text-center mb-10 md:mb-16 animate-in slide-in-from-top duration-1000 w-full px-4 flex flex-col items-center">
        <div className="glass px-10 md:px-20 py-8 md:py-14 rounded-[3rem] md:rounded-[5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] border border-white/50 relative overflow-hidden group mb-10 max-w-full">
          <div className="absolute inset-0 bg-emerald-100/10 group-hover:bg-emerald-200/20 transition-all duration-700"></div>
          <h1 className="flex flex-col items-center relative z-10">
            <span className="text-5xl md:text-[8rem] lg:text-[10rem] font-pixel text-emerald-900 drop-shadow-[0_10px_10px_rgba(0,0,0,0.1)] italic tracking-tighter leading-none animate-glow-emerald">T-REX</span>
            <span className="text-xl md:text-3xl lg:text-5xl font-pixel text-amber-500 mt-4 md:mt-6 drop-shadow-lg tracking-widest uppercase animate-glow-amber">KECEPIRIT</span>
          </h1>
        </div>
        <div className="glass px-6 md:px-10 py-3 md:py-4 rounded-full shadow-2xl border border-white/80 animate-in fade-in duration-1000 delay-300">
           <p className="text-emerald-700 font-black tracking-[0.2em] md:tracking-[0.4em] text-[8px] md:text-xs uppercase italic text-center">
             UAS Bahasa Inggris &bull; IT Specialist Edition
           </p>
        </div>
      </div>

      <div className="w-full max-w-5xl px-2 md:px-4 flex-grow flex flex-col mb-10 md:mb-16 relative">
        <div className="relative glass rounded-[3rem] md:rounded-[5rem] overflow-hidden shadow-[0_60px_120px_-40px_rgba(0,0,0,0.25)] border-[10px] md:border-[20px] border-white ring-1 ring-slate-200/50 flex-grow aspect-video md:aspect-auto min-h-[350px] md:min-h-[440px]">
          <canvas ref={canvasRef} width={800} height={400} className="w-full h-full cursor-pointer block touch-none" onClick={handleJump} />

          <div className="absolute top-6 md:top-10 left-6 md:left-10 z-[60] flex flex-col items-start gap-4 pointer-events-none">
             {isInvincible && (
               <div className="flex flex-col items-start gap-2 animate-in slide-in-from-left duration-500">
                 <div className="px-1 flex flex-col gap-1.5">
                   <span className="text-[6px] md:text-[7px] font-black text-amber-600 uppercase font-pixel tracking-[0.2em] drop-shadow-sm ml-1">Angel Mode Active</span>
                   <div className="relative w-40 md:w-56 h-2 md:h-3.5 bg-slate-900/40 rounded-full border border-white/30 overflow-hidden shadow-[0_0_25px_rgba(251,191,36,0.15)] backdrop-blur-xl">
                      <div className="absolute inset-0 bg-amber-400/10 pointer-events-none"></div>
                      <div 
                        className="h-full bg-gradient-to-r from-amber-200 via-amber-400 to-amber-100 transition-all duration-300 shadow-[0_0_20px_rgba(251,191,36,0.8)] relative"
                        style={{ width: `${(invincibilityTimeLeft / INVINCIBILITY_DURATION) * 100}%` }}
                      />
                   </div>
                 </div>
               </div>
             )}
          </div>

          {gameState === 'PLAYING' && (
            <div className="absolute top-6 md:top-10 right-6 md:right-10 flex flex-col md:flex-row gap-2 md:gap-5 pointer-events-none z-[60] animate-in fade-in duration-500">
              <div className="glass px-4 md:px-7 py-2 md:py-4 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl border border-white/70 flex flex-col items-end">
                <span className="text-[6px] md:text-[8px] text-slate-400 font-black uppercase tracking-widest mb-0.5 md:mb-1">RECORD</span>
                <span className="text-slate-900 font-black text-sm md:text-2xl font-pixel">{highScore.toString().padStart(5, '0')}</span>
              </div>
              <div className="bg-emerald-800/90 backdrop-blur-xl px-4 md:px-7 py-2 md:py-4 rounded-[1.5rem] md:rounded-[2.5rem] shadow-2xl border border-emerald-600/30 flex flex-col items-end">
                <span className="text-[6px] md:text-[8px] text-emerald-200 font-black uppercase tracking-widest mb-0.5 md:mb-1">SCORE</span>
                <span className="text-white font-black text-sm md:text-2xl font-pixel">{score.toString().padStart(5, '0')}</span>
              </div>
            </div>
          )}

          {(gameState === 'START' || gameState === 'GAMEOVER') && (
            <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm flex items-center justify-center p-4 md:p-8 z-50 animate-in fade-in duration-700">
                <div className="bg-white/95 backdrop-blur-3xl px-8 md:px-10 py-10 md:py-12 rounded-[2.5rem] md:rounded-[3.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.4)] border border-white flex flex-col items-center w-[300px] md:w-[360px] max-w-full text-center transform border-t-[8px] md:border-t-[12px] border-t-emerald-600">
                  <div className="text-6xl md:text-8xl mb-6 md:mb-8 animate-bounce leading-none">{gameState === 'START' ? '🦖' : '💥'}</div>
                  <h2 className="text-xl md:text-2xl font-black text-slate-900 mb-2 uppercase font-pixel tracking-tighter leading-tight">
                    {gameState === 'START' ? 'Siap Lari?' : 'Kecepirit!'}
                  </h2>
                  <p className="text-[8px] md:text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-8 md:mb-10 px-4">
                    {gameState === 'START' ? 'Ayo hindari rintangan kaktus' : `Skor yang diraih: ${score} meter`}
                  </p>
                  <button onClick={resetGame} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-4 md:py-6 rounded-[1.5rem] md:rounded-[2.5rem] text-lg md:text-2xl shadow-2xl transition-all transform active:scale-95 uppercase font-pixel tracking-tighter">
                    {gameState === 'START' ? 'START' : 'RETRY'}
                  </button>
                </div>
            </div>
          )}
        </div>
      </div>

      {gameState === 'QUIZ' && currentQuiz && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-3xl animate-in fade-in duration-500 overflow-y-auto">
           <div className="bg-white/95 backdrop-blur-2xl w-full max-w-lg rounded-[2.5rem] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.5)] border border-white/60 flex flex-col items-center p-6 md:p-8 text-center relative animate-in zoom-in-95 duration-500 my-auto">
              <div className={`w-12 h-12 md:w-16 md:h-16 rounded-[1.2rem] md:rounded-[1.5rem] flex items-center justify-center text-2xl md:text-4xl mb-4 shadow-xl border-2 border-white transition-all duration-300 ${quizFeedback === 'CORRECT' ? 'bg-emerald-400 rotate-12 scale-110 shadow-emerald-400/50' : quizFeedback === 'WRONG' ? 'bg-red-400 -rotate-12 scale-110 shadow-red-400/50' : 'bg-gradient-to-tr from-amber-400 to-yellow-200 animate-bounce shadow-amber-300/50'}`}>
                {quizFeedback === 'CORRECT' ? '✅' : quizFeedback === 'WRONG' ? '❌' : '👼'}
              </div>
              <div className="mb-4">
                <h3 className="text-[7px] md:text-[8px] font-black text-amber-600 uppercase tracking-[0.2em] md:tracking-[0.3em] mb-1 font-pixel opacity-80 italic">Scholarship Quiz</h3>
                <h2 className="text-lg md:text-2xl font-black text-slate-900 uppercase italic font-pixel leading-tight tracking-tighter">English Mastery</h2>
              </div>
              
              <div className="w-full space-y-3 md:space-y-4">
                {!quizExplanation ? (
                  <>
                    <div className="bg-slate-50/80 p-4 md:p-6 rounded-[1.2rem] md:rounded-[2rem] border border-white shadow-inner">
                      <p className="text-xs md:text-base font-bold text-slate-800 leading-relaxed italic">"{currentQuiz.question}"</p>
                    </div>
                    <div className={`grid grid-cols-1 gap-2 md:gap-3 ${quizFeedback !== 'NONE' ? 'pointer-events-none' : ''}`}>
                      {currentQuiz.options.map((opt, i) => (
                        <button 
                          key={i} 
                          onClick={() => handleQuizAnswer(i)} 
                          className={`flex items-center justify-center w-full font-bold py-3 md:py-4 px-4 md:px-6 rounded-[1rem] md:rounded-[1.5rem] border border-white shadow-md transition-all active:scale-95 text-[9px] md:text-xs italic ${
                            selectedIndex === i 
                              ? (i === currentQuiz.correctIndex ? 'bg-emerald-600 text-white border-emerald-400' : 'bg-red-600 text-white border-red-400')
                              : (quizFeedback !== 'NONE' && i === currentQuiz.correctIndex ? 'bg-emerald-100 text-emerald-900 border-emerald-400' : 'bg-white/90 hover:bg-emerald-700 hover:text-white text-emerald-900')
                          }`}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                    <div className="bg-slate-100/90 backdrop-blur-sm p-4 md:p-6 rounded-[1.2rem] md:rounded-[2rem] border border-white shadow-inner text-left">
                      <h4 className="text-[7px] md:text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2 font-pixel">Dino's Wisdom</h4>
                      {isExplaining ? (
                        <div className="flex justify-center py-2"><div className="w-5 h-5 md:w-6 md:h-6 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div></div>
                      ) : (
                        <p className="text-[10px] md:text-sm font-bold text-slate-700 leading-relaxed italic">"{quizExplanation}"</p>
                      )}
                    </div>
                    <button onClick={closeQuiz} className="w-full bg-slate-900 hover:bg-black text-white font-black py-4 md:py-5 rounded-[1rem] md:rounded-[1.5rem] text-sm md:text-lg shadow-xl transition-all active:scale-95 tracking-widest font-pixel">CONTINUE</button>
                  </div>
                )}
              </div>
           </div>
        </div>
      )}

      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-10 md:mb-16 px-4">
        <div className="glass p-8 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] shadow-xl border border-white/50 text-center flex flex-col items-center hover:translate-y-[-5px] transition-transform">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-emerald-50 text-emerald-700 rounded-[1.2rem] flex items-center justify-center mb-4 md:mb-6 font-black shadow-inner border border-emerald-100 text-[10px] md:text-base">SPACE</div>
          <h3 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-pixel">Lompat</h3>
          <p className="text-[10px] md:text-xs font-bold text-slate-600 leading-relaxed italic">Gunakan Spasi atau Panah Atas untuk melompati kaktus.</p>
        </div>
        <div className="glass p-8 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] shadow-xl border border-white/50 text-center flex flex-col items-center hover:translate-y-[-5px] transition-transform">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-amber-50 text-amber-600 rounded-[1.2rem] flex items-center justify-center mb-4 md:mb-6 text-2xl md:text-3xl shadow-inner border border-amber-100">👼</div>
          <h3 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-pixel">Kebal</h3>
          <p className="text-[10px] md:text-xs font-bold text-slate-600 leading-relaxed italic">Dapatkan perlindungan 'Angel Mode' dengan menjawab kuis secara benar.</p>
        </div>
        <div className="glass p-8 md:p-10 rounded-[2.5rem] md:rounded-[3.5rem] shadow-xl border border-white/50 text-center flex flex-col items-center hover:translate-y-[-5px] transition-transform">
          <div className="w-12 h-12 md:w-16 md:h-16 bg-blue-50 text-blue-700 rounded-[1.2rem] flex items-center justify-center mb-4 md:mb-6 text-2xl md:text-3xl shadow-inner border border-blue-100">🎨</div>
          <h3 className="text-[8px] md:text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 font-pixel">AI Theme</h3>
          <p className="text-[10px] md:text-xs font-bold text-slate-600 leading-relaxed italic">Ketik perintah di chat untuk mengganti <b>suasana</b> secara instan.</p>
        </div>
      </div>

      <div className="w-full max-w-5xl glass rounded-[3rem] md:rounded-[5rem] shadow-[0_80px_150px_-50px_rgba(0,0,0,0.2)] border-[10px] md:border-[14px] border-white overflow-hidden flex flex-col md:flex-row min-h-[500px] md:h-[600px] mb-16 md:mb-20 relative">
        <div className="md:w-1/3 bg-slate-900 p-8 md:p-14 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-48 md:w-72 h-48 md:h-72 bg-emerald-500/20 rounded-full blur-[80px] md:blur-[110px]"></div>
          <div className="relative z-10">
            <div className="w-16 h-16 md:w-24 md:h-24 bg-white/10 rounded-[2rem] md:rounded-[3rem] flex items-center justify-center text-3xl md:text-5xl mb-6 md:mb-12 backdrop-blur-xl border border-white/20">🦖</div>
            <h2 className="text-3xl md:text-5xl font-black uppercase italic mb-4 md:mb-6 leading-none tracking-tighter">Dino <br/><span className="text-emerald-400">Genius</span></h2>
            <p className="text-slate-400 text-[10px] md:text-sm font-bold leading-relaxed opacity-80 italic">
              "Mau warna badan baru atau suasana malam hari? Bilang aja, nanti aku sulap!"
            </p>
          </div>
          <div className="relative z-10 glass-dark px-6 md:px-8 py-3 md:py-4 rounded-[1.5rem] md:rounded-[2rem] text-[7px] md:text-[9px] font-black tracking-widest text-emerald-300 uppercase shadow-xl mt-6 md:mt-0">REAL-TIME ENV CONTROL</div>
        </div>

        <div className="md:w-2/3 flex flex-col bg-slate-50/40 backdrop-blur-md">
          <div className="flex-1 p-6 md:p-12 overflow-y-auto space-y-6 md:space-y-8 scroll-smooth">
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-4 duration-500`}>
                <div className={`max-w-[90%] md:max-w-[85%] px-6 md:px-10 py-4 md:py-6 rounded-[2rem] md:rounded-[3rem] text-[10px] md:text-sm font-bold shadow-lg ${
                  msg.role === 'user' ? 'bg-emerald-700 text-white rounded-tr-none' : 'glass text-slate-800 rounded-tl-none border-white/80'
                }`}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isChatLoading && (
              <div className="flex justify-start"><div className="glass px-6 py-3 md:px-8 md:py-4 rounded-full flex gap-2 md:gap-3 shadow-md"><div className="w-2 md:w-2.5 h-2 md:h-2.5 bg-emerald-500 rounded-full animate-bounce"></div><div className="w-2 md:w-2.5 h-2 md:h-2.5 bg-emerald-500 rounded-full animate-bounce delay-100"></div><div className="w-2 md:w-2.5 h-2 md:h-2.5 bg-emerald-500 rounded-full animate-bounce delay-200"></div></div></div>
            )}
          </div>
          <div className="p-6 md:p-10 glass-dark border-t border-white/10 flex gap-3 md:gap-5 items-center">
            <input 
              type="text" 
              value={chatInput} 
              onFocus={() => { isTyping.current = true; }} 
              onBlur={() => { isTyping.current = false; }} 
              onChange={(e) => setChatInput(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()} 
              placeholder="Ganti dino jadi ungu..." 
              className="flex-1 bg-white/10 border-none rounded-[1.5rem] md:rounded-[2.5rem] px-6 md:px-10 py-4 md:py-6 text-[10px] md:text-sm font-bold text-white placeholder-slate-500 focus:ring-4 focus:ring-emerald-500/50 outline-none transition-all shadow-inner" 
            />
            <button 
              onClick={handleSendMessage} 
              disabled={isChatLoading} 
              className="bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-900 h-14 md:h-20 px-6 md:px-12 rounded-[1.5rem] md:rounded-[2.5rem] font-black transition-all disabled:opacity-50 shadow-[0_15px_30px_rgba(16,185,129,0.3)] uppercase tracking-widest text-[9px] md:text-xs"
            >
              SEND
            </button>
          </div>
        </div>
      </div>

      <footer className="mb-10 md:mb-20 text-slate-400 text-[7px] md:text-[10px] font-black uppercase tracking-[0.2em] md:tracking-[0.5em] flex items-center gap-6 md:gap-12 w-full max-w-5xl px-8 text-center flex-col md:flex-row">
        <div className="hidden md:block h-px flex-1 bg-slate-200/60" />
        <div className="flex flex-col gap-1 md:gap-2">
          <span className="text-slate-500">Bahasa Inggris &bull; DOSEN: Marisa Fran Lina M.Pd</span>
          <span className="text-emerald-500/60">Created by Azis, Arkan & Oryza</span>
        </div>
        <div className="hidden md:block h-px flex-1 bg-slate-200/60" />
      </footer>
    </div>
  );
};

export default App;
