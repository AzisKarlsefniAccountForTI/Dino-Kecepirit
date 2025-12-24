
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameTheme, Obstacle, Particle } from './types';
import { PRESET_THEMES, getNextTheme } from './services/geminiService';

const GRAVITY = 0.6;
const JUMP_FORCE = -12;
const INITIAL_SPEED = 6;
const SPEED_INCREMENT = 0.001;
const GROUND_Y = 320; 
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
    question: "Kalimat 'Because the network was slow, the file transfer failed' termasuk jenis kalimat...",
    options: ["Simple sentence", "Compound sentence", "Complex sentence", "Run-on sentence"],
    correctIndex: 2
  },
  {
    question: "Manakah contoh kalimat topik (topic sentence) yang paling tepat untuk paragraf bertema teknologi?",
    options: [
      "Encryption scrambles data to prevent unauthorized access.",
      "Proper data security protocols are essential for protecting sensitive information in cloud computing environments.",
      "Regular security audits help identify vulnerabilities.",
      "Implementing multi-factor authentication adds protection."
    ],
    correctIndex: 1
  },
  {
    question: "Strategi membaca cepat untuk mendapatkan gambaran umum (general overview) dari sebuah teks disebut...",
    options: ["Scanning", "Skimming", "Inferring", "Summarizing"],
    correctIndex: 1
  },
  {
    question: "Strategi mendengarkan untuk menangkap ide umum atau inti sari dari sebuah percakapan disebut...",
    options: ["Listening for Specific Details", "Listening for Inference", "Listening for the Gist", "Listening for Vocabulary"],
    correctIndex: 2
  },
  {
    question: "Kalimat 'The system remains stable' menggunakan jenis verb...",
    options: ["Action verb", "Linking/State verb", "Passive verb", "Modal verb"],
    correctIndex: 1
  },
  {
    question: "Urutan bagian utama dalam sebuah artikel ilmiah (research article) yang benar adalah...",
    options: [
      "Abstract – Title – Introduction – Method – Results – Discussion – References",
      "Title – Abstract – Introduction – Method – Results – Discussion – Conclusion – References",
      "Title – Method – Abstract – Results – Discussion – References",
      "Abstract – Results – Title – Discussion – References"
    ],
    correctIndex: 1
  },
  {
    question: "Dalam konteks Cybersecurity, proses mengubah data menjadi kode untuk mencegah akses yang tidak sah disebut sebagai...",
    options: ["Phishing", "Encryption", "Authentication", "Debugging"],
    correctIndex: 1
  },
  {
    question: "Berdasarkan 'Tech Term Pictionary', manakah istilah serangan 'social engineering' yang bertujuan mencuri data sensitif melalui email menipu?",
    options: ["Firewall", "Virtual Reality (VR)", "Phishing", "Algorithm"],
    correctIndex: 2
  },
  {
    question: "Menurut 'Grammar Focus for Technical Reports', tenses mana yang digunakan untuk menyatakan fakta umum atau definisi teknis?",
    options: ["Simple Present Tense", "Present Continuous Tense", "Future Tense", "Simple Past Tense"],
    correctIndex: 0
  },
  {
    question: "Berdasarkan materi pengucapan TI, manakah cara yang benar untuk mengucapkan kata 'Cache' secara profesional?",
    options: ["/kæʧ/ (seperti 'Catch')", "'Cash-ay'", "/kæʃ/ (seperti 'Cash')", "/keɪk/ (seperti 'Cake')"],
    correctIndex: 2
  },
  {
    question: "Dalam komunikasi TI profesional, bagaimana Anda harus menyesuaikan bahasa saat berbicara dengan audiens 'External (Non-Technical)'?",
    options: [
      "Bebas jargon dan fokus pada solusi serta nilai bisnis.",
      "Kirim 'Wall of Text' untuk memastikan semua detail teknis masuk.",
      "Gunakan jargon teknis dan fokus pada detail koding spesifik.",
      "Fokus hanya pada detail teknis seperti commit IDs."
    ],
    correctIndex: 0
  },
  {
    question: "Menurut aturan 'Netiquette', apa yang harus dilakukan profesional TI agar daftar instruksi deployment mudah dibaca?",
    options: [
      "Gunakan bullet points untuk membuat daftar yang jelas.",
      "Tulis semua detail dalam satu paragraf panjang (Wall of Text).",
      "Gunakan slang informal dan singkatan untuk menghemat waktu.",
      "Kirim file teknis sebagai lampiran tanpa penjelasan di badan email."
    ],
    correctIndex: 0
  }
];

const App: React.FC = () => {
  const [gameState, setGameState] = useState<'START' | 'PLAYING' | 'GAMEOVER' | 'QUIZ'>('START');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [theme, setTheme] = useState<GameTheme>(PRESET_THEMES[0]);
  const [quizFeedback, setQuizFeedback] = useState<'NONE' | 'CORRECT' | 'WRONG'>('NONE');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [currentQuiz, setCurrentQuiz] = useState<QuizData | null>(null);
  const [invincibilityTimeLeft, setInvincibilityTimeLeft] = useState(0);
  const isInvincible = invincibilityTimeLeft > 0;
  const canRevive = useRef(true);
  const lastQuizScore = useRef(0);
  const lastQuestionIndex = useRef<number | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dinoY = useRef(GROUND_Y - DINO_HEIGHT);
  const dinoVy = useRef(0);
  const isJumping = useRef(false);
  const obstacles = useRef<Obstacle[]>([]);
  const particles = useRef<Particle[]>([]);
  const weatherParticles = useRef<{x: number, y: number, speed: number, size: number}[]>([]);
  const gameSpeed = useRef(INITIAL_SPEED);
  const frameId = useRef<number>(0);
  const scoreRef = useRef(0);
  const nextThemeScore = useRef(THEME_CHANGE_INTERVAL);
  
  const [screenShake, setScreenShake] = useState(0);

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
    weatherParticles.current = [];
    gameSpeed.current = INITIAL_SPEED;
    scoreRef.current = 0;
    canRevive.current = true;
    setInvincibilityTimeLeft(0);
    setScore(0);
    nextThemeScore.current = THEME_CHANGE_INTERVAL;
    lastQuizScore.current = 0;
    lastQuestionIndex.current = null;
    setQuizFeedback('NONE');
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
    
    setCurrentQuiz({
      ...selectedQuiz,
      options: optionsWithMetadata.map(o => o.text),
      correctIndex: optionsWithMetadata.findIndex(o => o.isCorrect)
    });
    
    setQuizFeedback('NONE');
    setSelectedIndex(null);
    setGameState('QUIZ');
  }, []);

  const handleQuizAnswer = (index: number) => {
    if (!currentQuiz || quizFeedback !== 'NONE') return;
    setSelectedIndex(index);
    const isCorrect = index === currentQuiz.correctIndex;
    setQuizFeedback(isCorrect ? 'CORRECT' : 'WRONG');
    
    setTimeout(() => {
       closeQuiz(isCorrect);
    }, 1500);
  };

  const closeQuiz = (isCorrect: boolean) => {
    if (isCorrect) {
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
    setSelectedIndex(null);
  };

  const handleJump = useCallback(() => {
    if (gameState === 'QUIZ') return;
    if (!isJumping.current && gameState === 'PLAYING') {
      dinoVy.current = JUMP_FORCE;
      isJumping.current = true;
      setScreenShake(4); 
      setTimeout(() => setScreenShake(0), 100);
    } else if (gameState === 'GAMEOVER' || gameState === 'START') {
      resetGame();
    }
  }, [gameState]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleJump();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleJump]);

  const updateThemeAuto = (currentScore: number) => {
    setTheme(prev => getNextTheme(prev.themeName));
    nextThemeScore.current += THEME_CHANGE_INTERVAL;
  };

  const drawCactus = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string, withSnow: boolean) => {
    ctx.fillStyle = color;
    ctx.fillRect(x + w * 0.3, y, w * 0.4, h);
    ctx.fillRect(x + w * 0.1, y + h * 0.4, w * 0.2, h * 0.15);
    ctx.fillRect(x + w * 0.1, y + h * 0.2, w * 0.1, h * 0.2);
    ctx.fillRect(x + w * 0.7, y + h * 0.3, w * 0.2, h * 0.15);
    ctx.fillRect(x + w * 0.8, y + h * 0.1, w * 0.1, h * 0.2);
    if (withSnow) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.fillRect(x + w * 0.3, y - 2, w * 0.4, 4);
    }
  };

  const drawDinoBlocks = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, isJumping: boolean, score: number, vy: number) => {
    const shadowColor = "rgba(0,0,0,0.5)";
    const highlightColor = "rgba(255,255,255,0.4)";
    const bellyColor = "rgba(255,255,255,0.25)";
    const scaleColor = "rgba(0,0,0,0.2)";
    
    // Smooth Animation Logic - Reduced vibration with slower walkPhase
    const walkPhase = score / 8.0; 
    
    const leg1Y = isJumping ? (vy < 0 ? -10 : 6) : Math.sin(walkPhase) * 10;
    const leg1X = isJumping ? 0 : Math.cos(walkPhase) * 3;
    const leg2Y = isJumping ? (vy < 0 ? -3 : 14) : Math.sin(walkPhase + Math.PI) * 10;
    const leg2X = isJumping ? 0 : Math.cos(walkPhase + Math.PI) * 3;
    
    const bobHeight = isJumping ? 0 : Math.abs(Math.sin(walkPhase * 2.0)) * 2.0;
    const bodyY = y + bobHeight;

    const bodyGrad = ctx.createLinearGradient(x, bodyY, x + 50, bodyY + DINO_HEIGHT);
    bodyGrad.addColorStop(0, color);
    bodyGrad.addColorStop(0.7, color);
    bodyGrad.addColorStop(1, "rgba(0,0,0,0.25)");

    // Legs
    ctx.fillStyle = color;
    ctx.fillRect(x + 16 + leg1X, bodyY + 68, 14, 14 + (leg1Y > 0 ? leg1Y : 0));
    ctx.fillStyle = shadowColor;
    ctx.fillRect(x + 16 + leg1X, bodyY + 68, 14, 14 + (leg1Y > 0 ? leg1Y : 0));
    ctx.fillStyle = color;
    ctx.fillRect(x + 18 + leg1X, bodyY + 78 + (leg1Y > 0 ? leg1Y : 0), 12, 6); 

    // Torso
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x + 8, bodyY + 30, 44, 44); 
    ctx.fillStyle = bellyColor;
    ctx.fillRect(x + 16, bodyY + 44, 14, 24);

    // Scales
    ctx.fillStyle = scaleColor;
    [[12, 35], [25, 45], [38, 32], [10, 55]].forEach(([sx, sy]) => ctx.fillRect(x + sx, bodyY + sy, 4, 4));

    // Tail
    const tailSway = isJumping ? 0 : Math.sin(walkPhase - 0.5) * 2;
    ctx.fillStyle = color;
    ctx.fillRect(x - 14, bodyY + 40 + tailSway, 24, 24);
    ctx.fillRect(x - 28, bodyY + 48 + tailSway * 1.5, 16, 14);

    // Arms
    const armWiggle = isJumping ? vy * 0.4 : Math.cos(walkPhase) * 4;
    ctx.fillStyle = color;
    ctx.fillRect(x + 42, bodyY + 36 + armWiggle, 18, 8); 
    ctx.fillRect(x + 54, bodyY + 36 + armWiggle, 8, 18); 

    // Head
    const headBob = isJumping ? 0 : Math.abs(Math.sin(walkPhase * 2.0 + 0.3)) * 1.2;
    const headY = bodyY - 4 + headBob;
    ctx.fillStyle = color;
    ctx.fillRect(x + 12, headY, 68, 44); 
    ctx.fillStyle = highlightColor;
    ctx.fillRect(x + 12, headY, 68, 8);
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(x + 45, headY + 24, 35, 3);

    // Teeth
    ctx.fillStyle = "#ffffff";
    for(let i=0; i<4; i++) {
        const tx = x + 48 + (i * 8);
        ctx.beginPath();
        ctx.moveTo(tx, headY + 27);
        ctx.lineTo(tx + 3, headY + 33);
        ctx.lineTo(tx + 6, headY + 27);
        ctx.fill();
    }
    
    // Eye
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(x + 40, headY + 6, 16, 16);
    ctx.fillStyle = "#000000";
    ctx.fillRect(x + 47, headY + 9, 7, 7);

    // Front Leg
    ctx.fillStyle = color;
    ctx.fillRect(x + 32 + leg2X, bodyY + 68, 16, 16 + (leg2Y > 0 ? leg2Y : 0));
    ctx.fillStyle = highlightColor;
    ctx.fillRect(x + 32 + leg2X, bodyY + 68, 4, 16 + (leg2Y > 0 ? leg2Y : 0));
    ctx.fillStyle = color;
    ctx.fillRect(x + 35 + leg2X, bodyY + 78 + (leg2Y > 0 ? leg2Y : 0), 12, 6);
  };

  const drawWeather = (ctx: CanvasRenderingContext2D, canvasWidth: number, themeName: string, score: number) => {
    const time = score / 50;

    if (themeName === "Pagi Kampus") {
      ctx.fillStyle = "#fbbf24";
      ctx.beginPath(); ctx.arc(700, 60, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      const cloudX = (time * 15) % (canvasWidth + 200) - 100;
      ctx.fillRect(cloudX, 40, 60, 20); ctx.fillRect(cloudX + 350, 80, 80, 25);
    } else if (themeName === "Malam Lembur") {
      ctx.fillStyle = "#f1f5f9";
      ctx.beginPath(); ctx.arc(700, 60, 25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#0f172a";
      ctx.beginPath(); ctx.arc(710, 55, 25, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#ffffff";
      for (let i = 0; i < 12; i++) { // Reduced star count
        const sx = (i * 157.5) % canvasWidth;
        const sy = (i * 97) % 150;
        const opacity = Math.abs(Math.sin(time * 0.5 + i)) * 0.6;
        ctx.globalAlpha = opacity;
        ctx.fillRect(sx, sy, 1.5, 1.5);
      }
      ctx.globalAlpha = 1.0;
    } else if (themeName === "Cyberpunk IT") {
      ctx.strokeStyle = "rgba(217, 70, 239, 0.15)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 3; i++) { // Fewer lines
        const ly = 60 + i * 60;
        ctx.beginPath(); ctx.moveTo(0, ly); ctx.lineTo(canvasWidth, ly); ctx.stroke();
      }
      ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
      for (let i = 0; i < 6; i++) {
        const cx = (i * 150) % canvasWidth;
        const cy = (time * 40 + i * 50) % 300;
        ctx.fillRect(cx, cy, 1.5, 8);
      }
    } else if (themeName === "Gurun Pasir") {
      ctx.fillStyle = "rgba(146, 64, 14, 0.08)";
      ctx.beginPath();
      ctx.moveTo(0, GROUND_Y);
      ctx.quadraticCurveTo(400, GROUND_Y - 40, 800, GROUND_Y);
      ctx.fill();
      ctx.strokeStyle = "rgba(251, 191, 36, 0.08)";
      for (let i = 0; i < 2; i++) {
         const wx = (time * 30 + i * 350) % canvasWidth;
         ctx.beginPath(); ctx.moveTo(wx, 200); ctx.bezierCurveTo(wx + 20, 180, wx - 20, 160, wx, 140); ctx.stroke();
      }
    } else if (themeName === "Musim Salju") {
      if (weatherParticles.current.length < 35) { // Reduced snow count
        weatherParticles.current.push({
          x: Math.random() * canvasWidth,
          y: -10,
          speed: 1 + Math.random() * 1.5,
          size: 2 + Math.random() * 2
        });
      }
      ctx.fillStyle = "#ffffff";
      weatherParticles.current.forEach(p => {
        p.y += p.speed;
        p.x += Math.sin(p.y / 30) * 0.5;
        if (p.y > 400) p.y = -10;
        ctx.fillRect(p.x, p.y, p.size, p.size);
      });
    } else if (themeName === "Senja IT") {
      const sunGrad = ctx.createRadialGradient(400, 280, 0, 400, 280, 120);
      sunGrad.addColorStop(0, "rgba(253, 186, 116, 0.6)");
      sunGrad.addColorStop(1, "rgba(124, 45, 18, 0)");
      ctx.fillStyle = sunGrad;
      ctx.beginPath(); ctx.arc(400, 280, 120, 0, Math.PI, true); ctx.fill();
      ctx.fillStyle = "rgba(234, 88, 12, 0.3)";
      const sCloudX = (time * 12) % (canvasWidth + 300) - 150;
      ctx.fillRect(sCloudX, 110, 80, 12); ctx.fillRect(sCloudX + 450, 160, 100, 10);
    }
  };

  const gameLoop = useCallback(() => {
    if (gameState !== 'PLAYING') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawWeather(ctx, canvas.width, theme.themeName, scoreRef.current);

    ctx.strokeStyle = theme.ground;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, GROUND_Y); ctx.lineTo(canvas.width, GROUND_Y); ctx.stroke();

    dinoVy.current += GRAVITY;
    dinoY.current += dinoVy.current;
    if (dinoY.current > GROUND_Y - DINO_HEIGHT) {
      dinoY.current = GROUND_Y - DINO_HEIGHT;
      dinoVy.current = 0;
      isJumping.current = false;
    }

    scoreRef.current += 1;
    const currentDisplayScore = Math.floor(scoreRef.current / 10);
    setScore(currentDisplayScore);
    gameSpeed.current += SPEED_INCREMENT;

    if (currentDisplayScore >= nextThemeScore.current) {
      updateThemeAuto(currentDisplayScore);
    }

    if (currentDisplayScore > lastQuizScore.current + QUIZ_CHANCE_INTERVAL && Math.random() < 0.005) {
      lastQuizScore.current = currentDisplayScore;
      startQuiz();
      return; 
    }

    if (obstacles.current.length === 0 || canvas.width - obstacles.current[obstacles.current.length - 1].x > OBSTACLE_MIN_GAP + Math.random() * 400) {
      const spawnPterodactyl = currentDisplayScore > 400 && Math.random() < 0.3;
      if (spawnPterodactyl) {
        obstacles.current.push({ 
          id: Date.now() + Math.random(), 
          x: canvas.width, 
          width: 60, height: 40, 
          type: 'pterodactyl',
          yOffset: Math.random() > 0.5 ? 50 : 130
        });
      } else {
        obstacles.current.push({ 
          id: Date.now() + Math.random(), 
          x: canvas.width, 
          width: 35 + Math.random() * 30, 
          height: 30 + Math.random() * 30, 
          type: 'cactus' 
        });
      }
    }

    const dinoRect = { x: 50 + 10, y: dinoY.current + 10, w: 50, h: DINO_HEIGHT - 20 };
    obstacles.current.forEach(obs => {
      obs.x -= gameSpeed.current;
      const obsY = obs.type === 'cactus' ? GROUND_Y - obs.height : GROUND_Y - obs.yOffset;
      const obsH = obs.height;
      if (!isInvincible) {
        if ( dinoRect.x < obs.x + obs.width && dinoRect.x + dinoRect.w > obs.x && dinoRect.y < obsY + obsH && dinoRect.y + dinoRect.h > obsY ) {
          if (canRevive.current) { canRevive.current = false; startQuiz(); }
          else { setGameState('GAMEOVER'); if (currentDisplayScore > highScore) setHighScore(currentDisplayScore); }
        }
      }
    });
    obstacles.current = obstacles.current.filter(obs => obs.x + obs.width > -50);

    // Reduced dust particles to prevent lag
    if (Math.random() > 0.95 && !isJumping.current) {
       particles.current.push({ id: Math.random(), x: 70, y: dinoY.current + DINO_HEIGHT - 10, vx: -gameSpeed.current * 0.3, vy: Math.random() * 1.5, life: 1.0 });
    }
    particles.current.forEach(p => { 
      p.x += p.vx; p.y += p.vy; p.life -= 0.04; 
      ctx.globalAlpha = p.life; ctx.fillStyle = theme.particle; ctx.fillRect(p.x, p.y, 3, 3); 
    });
    particles.current = particles.current.filter(p => p.life > 0);
    ctx.globalAlpha = 1.0;

    const dx = 50;
    const dy = dinoY.current;
    if (isInvincible) {
      const pulse = Math.sin(Date.now() / 200);
      ctx.save();
      ctx.shadowBlur = 20;
      ctx.shadowColor = `rgba(251,191,36,0.6)`;
      ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 3; ctx.beginPath();
      ctx.ellipse(dx + 35, dy - 20 + pulse * 4, 25, 5, 0, 0, Math.PI * 2); ctx.stroke();
      drawDinoBlocks(ctx, dx, dy, theme.dino, isJumping.current, scoreRef.current, dinoVy.current);
      ctx.restore();
    } else {
      drawDinoBlocks(ctx, dx, dy, theme.dino, isJumping.current, scoreRef.current, dinoVy.current);
    }

    obstacles.current.forEach(obs => { 
      if (obs.type === 'cactus') {
        drawCactus(ctx, obs.x, GROUND_Y - obs.height, obs.width, obs.height, theme.cactus, theme.themeName === "Musim Salju"); 
      } else {
        const flapPhase = scoreRef.current / 10;
        const wingY = Math.sin(flapPhase) * 12;
        ctx.fillStyle = theme.cactus;
        ctx.fillRect(obs.x + obs.width * 0.3, GROUND_Y - obs.yOffset! + obs.height * 0.4, obs.width * 0.4, obs.height * 0.2);
        ctx.fillRect(obs.x + obs.width * 0.6, GROUND_Y - obs.yOffset! + obs.height * 0.35, obs.width * 0.2, obs.height * 0.15);
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.width * 0.4, GROUND_Y - obs.yOffset! + obs.height * 0.5);
        ctx.lineTo(obs.x + obs.width * 0.1, GROUND_Y - obs.yOffset! + obs.height * 0.5 - wingY);
        ctx.lineTo(obs.x + obs.width * 0.4, GROUND_Y - obs.yOffset! + obs.height * 0.6);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(obs.x + obs.width * 0.6, GROUND_Y - obs.yOffset! + obs.height * 0.5);
        ctx.lineTo(obs.x + obs.width * 0.9, GROUND_Y - obs.yOffset! + obs.height * 0.5 - wingY);
        ctx.lineTo(obs.x + obs.width * 0.6, GROUND_Y - obs.yOffset! + obs.height * 0.6);
        ctx.fill();
      }
    });

    frameId.current = requestAnimationFrame(gameLoop);
  }, [gameState, theme, highScore, isInvincible, startQuiz]);

  useEffect(() => {
    if (gameState === 'PLAYING') frameId.current = requestAnimationFrame(gameLoop);
    return () => { if (frameId.current) cancelAnimationFrame(frameId.current); };
  }, [gameState, gameLoop]);

  return (
    <div className="flex flex-col items-center min-h-screen py-8 md:py-16 px-4 relative overflow-x-hidden">
      <div className="text-center mb-8 md:mb-12 animate-in slide-in-from-top duration-1000 w-full px-4 flex flex-col items-center">
        <div className="glass px-10 md:px-20 py-8 md:py-14 rounded-[3rem] md:rounded-[5rem] shadow-[0_40px_80px_-20px_rgba(0,0,0,0.1)] border border-white/50 relative overflow-hidden group mb-8 max-w-full">
          <div className="absolute inset-0 bg-emerald-100/10 group-hover:bg-emerald-200/20 transition-all duration-700"></div>
          <h1 className="flex flex-col items-center relative z-10">
            <span className="text-5xl md:text-[8rem] lg:text-[10rem] font-pixel text-emerald-900 drop-shadow-md italic tracking-tighter leading-none animate-glow-emerald">T-REX</span>
            <span className="text-xl md:text-3xl lg:text-5xl font-pixel text-amber-500 mt-4 md:mt-6 drop-shadow-lg tracking-widest uppercase animate-glow-amber">KECEPIRIT</span>
          </h1>
        </div>
        <div className="glass px-6 md:px-8 py-2 md:py-3 rounded-full shadow-xl border border-white/80 animate-in fade-in duration-1000 delay-300">
           <p className="text-emerald-700 font-black tracking-[0.2em] md:tracking-[0.4em] text-[7px] md:text-xs uppercase italic text-center">
             UAS Bahasa Inggris &bull; IT Specialist Edition &bull; 2025
           </p>
        </div>
      </div>

      <div className="w-full max-w-5xl px-2 md:px-4 flex-grow flex flex-col mb-8 md:mb-12 relative">
        <div 
          className="relative glass rounded-[2.5rem] md:rounded-[4rem] overflow-hidden shadow-2xl border-[8px] md:border-[16px] border-white flex-grow aspect-video md:aspect-auto min-h-[350px] md:min-h-[440px] transition-all duration-1000"
          style={{ 
            background: theme.gradient,
            transform: `translateY(${screenShake}px)`,
            transition: 'transform 0.05s linear'
          }}
        >
          <canvas ref={canvasRef} width={800} height={400} className="w-full h-full cursor-pointer block touch-none" onClick={handleJump} />

          {gameState === 'PLAYING' && (
            <div className="absolute top-6 md:top-8 right-6 md:right-8 flex flex-col md:flex-row gap-2 md:gap-4 pointer-events-none z-[60] animate-in fade-in duration-500">
              <div className="glass px-3 md:px-5 py-1.5 md:py-3 rounded-2xl shadow-xl border border-white/70 flex flex-col items-end">
                <span className="text-[5px] md:text-[7px] text-slate-400 font-black uppercase tracking-widest">HI</span>
                <span className="text-slate-900 font-black text-xs md:text-xl">{highScore.toString().padStart(5, '0')}</span>
              </div>
              <div className="bg-emerald-800/90 backdrop-blur-xl px-3 md:px-5 py-1.5 md:py-3 rounded-2xl shadow-xl border border-emerald-600/30 flex flex-col items-end">
                <span className="text-[5px] md:text-[7px] text-emerald-200 font-black uppercase tracking-widest">SCORE</span>
                <span className="text-white font-black text-xs md:text-xl">{score.toString().padStart(5, '0')}</span>
              </div>
            </div>
          )}

          {(gameState === 'START' || gameState === 'GAMEOVER') && (
            <div className="absolute inset-0 bg-slate-900/10 backdrop-blur-[2px] flex items-center justify-center p-4 z-50 animate-in fade-in duration-700">
                <div className="bg-white/95 backdrop-blur-3xl px-8 md:px-10 py-10 rounded-[2.5rem] shadow-2xl border border-white flex flex-col items-center w-[280px] md:w-[340px] max-w-full text-center transform border-t-8 border-t-emerald-600">
                  <div className="text-5xl md:text-7xl mb-6 animate-bounce">{gameState === 'START' ? '🦖' : '💥'}</div>
                  <h2 className="text-lg md:text-xl font-black text-slate-900 mb-2 uppercase tracking-tighter">
                    {gameState === 'START' ? 'Mulai Lari' : 'Gagal!'}
                  </h2>
                  <p className="text-[7px] md:text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-8">
                    {gameState === 'START' ? 'Spasi / Klik untuk lompat' : `Skor: ${score} meter`}
                  </p>
                  <button onClick={resetGame} className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-black py-4 rounded-[1.5rem] text-sm md:text-xl shadow-xl transition-all transform active:scale-95 uppercase tracking-tighter">
                    {gameState === 'START' ? 'START' : 'RETRY'}
                  </button>
                </div>
            </div>
          )}
        </div>
      </div>

      {gameState === 'QUIZ' && currentQuiz && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xl animate-in fade-in duration-500 overflow-y-auto">
           <div className="bg-white/95 backdrop-blur-2xl w-full max-w-lg rounded-[2.5rem] shadow-2xl border border-white/60 flex flex-col items-center p-6 md:p-8 text-center relative animate-in zoom-in-95 duration-500 my-auto">
              <div className={`w-12 h-12 md:w-16 md:h-16 rounded-[1.2rem] flex items-center justify-center text-2xl md:text-3xl mb-4 shadow-xl transition-all duration-300 ${quizFeedback === 'CORRECT' ? 'bg-emerald-400 rotate-12 scale-110' : quizFeedback === 'WRONG' ? 'bg-red-400 -rotate-12 scale-110' : 'bg-amber-400'}`}>
                {quizFeedback === 'CORRECT' ? '✅' : quizFeedback === 'WRONG' ? '❌' : '🎓'}
              </div>
              <h2 className="text-lg md:text-xl font-black text-slate-900 uppercase italic tracking-tighter mb-6">Scholarship Challenge</h2>
              <div className="w-full space-y-3">
                <div className="bg-slate-50/80 p-4 rounded-[1.2rem] border border-white shadow-inner">
                  <p className="text-xs md:text-sm font-bold text-slate-800 leading-relaxed italic">"{currentQuiz.question}"</p>
                </div>
                <div className={`grid grid-cols-1 gap-2 ${quizFeedback !== 'NONE' ? 'pointer-events-none' : ''}`}>
                  {currentQuiz.options.map((opt, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleQuizAnswer(i)} 
                      className={`flex items-center justify-between w-full font-bold py-3 px-5 rounded-[1rem] border border-white shadow-sm transition-all active:scale-95 text-[9px] md:text-xs italic ${
                        selectedIndex === i 
                          ? (i === currentQuiz.correctIndex ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white')
                          : (quizFeedback !== 'NONE' && i === currentQuiz.correctIndex ? 'bg-emerald-100 text-emerald-900' : 'bg-white/90 hover:bg-emerald-700 hover:text-white text-emerald-900')
                      }`}
                    >
                      <span>{opt}</span>
                    </button>
                  ))}
                </div>
              </div>
           </div>
        </div>
      )}

      {/* COMPACT CONTROL PANEL */}
      <div className="w-full max-w-5xl glass rounded-[1.5rem] md:rounded-[2.5rem] shadow-xl border-[4px] md:border-[8px] border-white overflow-hidden flex flex-col md:flex-row min-h-[160px] mb-8">
        <div className="md:w-[22%] bg-slate-900 p-6 text-white flex flex-col justify-center relative overflow-hidden">
          <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-[50px]"></div>
          <div className="relative z-10">
            <h2 className="text-lg md:text-xl font-black uppercase italic mb-1 tracking-tighter font-pixel text-emerald-400">Suasana</h2>
            <p className="text-slate-400 text-[7px] md:text-[8px] font-bold opacity-60 italic">Atur atmosfir lari Dino-mu.</p>
          </div>
        </div>

        <div className="md:w-[78%] p-4 bg-slate-50/30 backdrop-blur-md flex flex-col justify-center">
           <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {PRESET_THEMES.map((t, i) => (
                <button 
                  key={i} 
                  onClick={() => setTheme(t)}
                  className={`group relative flex flex-col overflow-hidden rounded-[1rem] border-[2px] transition-all hover:scale-105 active:scale-95 ${theme.themeName === t.themeName ? 'border-emerald-500 bg-white shadow-md' : 'border-white bg-white/40 shadow-sm'}`}
                >
                  <div className="w-full h-10 md:h-12 relative flex items-center justify-center" style={{ background: t.gradient }}>
                    <span className="text-lg md:text-xl group-hover:rotate-6 transition-transform">{t.icon}</span>
                  </div>
                  <div className="p-1.5 flex flex-col items-center">
                    <span className={`text-[5px] md:text-[7px] font-black uppercase tracking-tighter text-center truncate w-full ${theme.themeName === t.themeName ? 'text-emerald-900' : 'text-slate-500'}`}>{t.themeName}</span>
                  </div>
                </button>
              ))}
           </div>
        </div>
      </div>

      <footer className="mb-8 w-full max-w-5xl px-8 flex flex-col items-center gap-4">
        <div className="w-full h-px bg-slate-200/30" />
        <div className="flex flex-col md:flex-row items-center justify-center gap-4 text-slate-400 text-[6px] md:text-[8px] font-black uppercase tracking-[0.15em] italic text-center">
          <div className="flex items-center gap-2">
            <span className="text-emerald-600 opacity-80">Team:</span>
            <span className="text-slate-600">Azis • Arkan • Oryza</span>
          </div>
          <div className="hidden md:block w-0.5 h-0.5 bg-slate-300 rounded-full" />
          <div className="text-slate-500 opacity-60">UAS Bahasa Inggris TI &bull; 2025</div>
        </div>
      </footer>
    </div>
  );
};

export default App;
