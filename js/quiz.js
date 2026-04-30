/**
 * Sports QA Human Study - Static Quiz Interface
 * Uses localStorage for persistence and FormSpree for submission.
 */

(function () {
    // ============================================================
    // CONFIGURATION
    // ============================================================
    const FORMSPREE_URL = "https://formspree.io/f/xjgppavp";

    // Sport detection from URL or global
    const sport = window.CURRENT_SPORT || "basketball";
    const sportName = sport.charAt(0).toUpperCase() + sport.slice(1);
    const STORAGE_SESSION_KEY = "bqa_" + sport + "_session";
    const STORAGE_ANSWERS_KEY = "bqa_" + sport + "_answers";

    // ============================================================
    // State
    // ============================================================
    let currentIndex = 0;
    let answers = {};
    let selectedOption = null;
    let selectedConfidence = null; // must be chosen by user
    let session = null;

    // Auto-save interval (30 seconds)
    const AUTO_SAVE_INTERVAL = 30000;

    // ============================================================
    // DOM Elements
    // ============================================================
    const videoPlayer = document.getElementById("videoPlayer");
    const videoLoading = document.getElementById("videoLoading");
    const videoError = document.getElementById("videoError");
    const categoryName = document.getElementById("categoryName");
    const categoryProgress = document.getElementById("categoryProgress");
    const questionNumber = document.getElementById("questionNumber");
    const questionText = document.getElementById("questionText");
    const optionsContainer = document.getElementById("optionsContainer");
    const feedback = document.getElementById("feedback");
    const feedbackIcon = document.getElementById("feedbackIcon");
    const feedbackText = document.getElementById("feedbackText");
    const submitBtn = document.getElementById("submitBtn");
    const nextBtn = document.getElementById("nextBtn");
    const prevBtn = document.getElementById("prevBtn");
    const finishBtn = document.getElementById("finishBtn");
    const progressText = document.getElementById("progressText");
    const progressBar = document.getElementById("progressBar");

    // Pretty names for question types (forecasting)
    const TYPE_DISPLAY_NAMES = {
        "Q1": "Category Q1",
        "Q2": "Category Q2",
        "Q3": "Category Q3",
        "Q4": "Category Q4",
        "Q5": "Category Q5",
        "Q6": "Category Q6",
        "Q7": "Category Q7",
        "Q8": "Category Q8",
        "Q9": "Category Q9",
        "Q10": "Category Q10",
    };

    // ============================================================
    // Initialization
    // ============================================================
    function init() {
        // Check session
        const savedSession = localStorage.getItem(STORAGE_SESSION_KEY);
        if (!savedSession) {
            window.location.href = "start.html?sport=" + sport;
            return;
        }
        session = JSON.parse(savedSession);
        document.getElementById("navUserId").textContent = session.userId;
        document.getElementById("navTitle").textContent = sportName + " Video QA";

        // Load saved answers
        const savedAnswers = localStorage.getItem(STORAGE_ANSWERS_KEY);
        if (savedAnswers) {
            answers = JSON.parse(savedAnswers);
        }

        // Find first unanswered question to resume
        for (let i = 0; i < QUESTIONS.length; i++) {
            const qId = String(QUESTIONS[i].id);
            if (!answers[qId] || !answers[qId].submitted) {
                currentIndex = i;
                break;
            }
            if (i === QUESTIONS.length - 1) {
                currentIndex = i;
            }
        }

        loadQuestion(currentIndex);
        updateProgress();

        // Event listeners
        submitBtn.addEventListener("click", handleSubmit);
        nextBtn.addEventListener("click", () => navigate(1));
        prevBtn.addEventListener("click", () => navigate(-1));
        finishBtn.addEventListener("click", handleFinish);

        // Confidence buttons
        document.querySelectorAll(".confidence-btn").forEach((btn) => {
            btn.addEventListener("click", function () {
                if (btn.classList.contains("disabled")) return;
                document.querySelectorAll(".confidence-btn").forEach((b) => b.classList.remove("active"));
                btn.classList.add("active");
                selectedConfidence = btn.dataset.confidence;
                submitBtn.disabled = !(selectedOption && selectedConfidence);
            });
        });

        // Auto-save every 30 seconds
        setInterval(saveAnswers, AUTO_SAVE_INTERVAL);
    }

    // ============================================================
    // Persistence
    // ============================================================
    function saveAnswers() {
        localStorage.setItem(STORAGE_ANSWERS_KEY, JSON.stringify(answers));
    }

    // ============================================================
    // Video
    // ============================================================
    function getVideoUrl(questionId) {
        const qId = String(questionId);
        let path = null;
        if (typeof VIDEO_MAPPING !== "undefined" && VIDEO_MAPPING[qId]) {
            path = VIDEO_MAPPING[qId];
        } else {
            // Fallback: try to find in question data
            const q = QUESTIONS.find((qq) => String(qq.id) === qId);
            if (q && q.video_url) {
                path = q.video_url;
            }
        }
        if (!path) return null;
        // Prepend base URL if configured (for R2/CDN hosting)
        const base = (typeof VIDEO_BASE_URL !== "undefined" && VIDEO_BASE_URL) ? VIDEO_BASE_URL : "";
        return base ? base.replace(/\/+$/, "") + "/" + path : path;
    }

    function loadVideo(questionId) {
        const url = getVideoUrl(questionId);

        videoPlayer.style.display = "none";
        videoError.style.display = "none";
        videoLoading.style.display = "flex";

        if (!url) {
            videoLoading.style.display = "none";
            videoError.style.display = "block";
            return;
        }

        videoPlayer.src = url;

        videoPlayer.onloadeddata = function () {
            videoLoading.style.display = "none";
            videoPlayer.style.display = "block";
        };

        videoPlayer.onerror = function () {
            videoLoading.style.display = "none";
            videoError.style.display = "block";
        };

        videoPlayer.load();
    }

    // ============================================================
    // Question Loading
    // ============================================================
    function loadQuestion(index) {
        const q = QUESTIONS[index];
        const qId = String(q.id);

        // Category header
        const displayName = TYPE_DISPLAY_NAMES[q.question_type] || q.question_type;
        categoryName.textContent = displayName;

        // Category progress
        const typeQuestions = QUESTIONS.filter((qq) => qq.question_type === q.question_type);
        const typeAnswered = typeQuestions.filter(
            (qq) => answers[String(qq.id)] && answers[String(qq.id)].submitted
        ).length;
        const typeIndex = typeQuestions.indexOf(q) + 1;
        categoryProgress.textContent =
            `Question ${typeIndex} of ${typeQuestions.length} in category (${typeAnswered}/${typeQuestions.length} answered)`;

        // Question text
        questionNumber.textContent = `Question ${index + 1} of ${QUESTIONS.length}`;
        questionText.textContent = q.question;

        // Load video
        loadVideo(q.id);

        // Render options
        selectedOption = null;
        optionsContainer.innerHTML = "";
        const existingAnswer = answers[qId];

        q.options.forEach((opt) => {
            const btn = document.createElement("button");
            btn.className = "option-btn";
            const letterSpan = document.createElement("span");
            letterSpan.className = "option-letter";
            letterSpan.textContent = opt.letter;
            const textSpan = document.createElement("span");
            textSpan.className = "option-text";
            textSpan.textContent = opt.text;
            btn.appendChild(letterSpan);
            btn.appendChild(textSpan);

            if (existingAnswer && existingAnswer.submitted) {
                btn.classList.add("disabled");
                if (session.showAnswers) {
                    if (opt.letter === existingAnswer.correctAnswer) {
                        btn.classList.add("correct");
                    }
                    if (opt.letter === existingAnswer.selected && !existingAnswer.isCorrect) {
                        btn.classList.add("incorrect");
                    }
                } else {
                    if (opt.letter === existingAnswer.selected) {
                        btn.classList.add("selected");
                    }
                }
            } else {
                btn.addEventListener("click", () => selectOption(opt.letter, btn));
            }

            optionsContainer.appendChild(btn);
        });

        // Confidence buttons
        const confBtns = document.querySelectorAll(".confidence-btn");
        if (existingAnswer && existingAnswer.submitted) {
            // Show saved confidence, disable buttons
            confBtns.forEach((btn) => {
                btn.classList.remove("active");
                btn.classList.add("disabled");
                if (btn.dataset.confidence === existingAnswer.confidence) {
                    btn.classList.add("active");
                }
            });
        } else {
            // Reset — no default, user must choose
            selectedConfidence = null;
            confBtns.forEach((btn) => {
                btn.classList.remove("active", "disabled");
            });
        }

        // Show state based on whether already answered
        feedback.style.display = "none";
        if (existingAnswer && existingAnswer.submitted) {
            submitBtn.style.display = "none";
            if (session.showAnswers) {
                showFeedback(existingAnswer.isCorrect, existingAnswer.correctAnswer);
            }
            showNavigationButtons(index);
        } else {
            submitBtn.style.display = "inline-block";
            submitBtn.disabled = true;
            submitBtn.textContent = "Submit Answer";
            nextBtn.style.display = "none";
            finishBtn.style.display = "none";
        }

        // Prev button
        prevBtn.disabled = index === 0;
    }

    // ============================================================
    // Option Selection
    // ============================================================
    function selectOption(letter, btnElement) {
        document.querySelectorAll(".option-btn").forEach((b) => b.classList.remove("selected"));
        btnElement.classList.add("selected");
        selectedOption = letter;
        submitBtn.disabled = !(selectedOption && selectedConfidence);
    }

    // ============================================================
    // Submit Answer
    // ============================================================
    function handleSubmit() {
        if (!selectedOption) return;

        const q = QUESTIONS[currentIndex];
        const qId = String(q.id);
        const isCorrect = selectedOption === q.correct_answer;

        // Store answer
        answers[qId] = {
            selected: selectedOption,
            confidence: selectedConfidence,
            submitted: true,
            isCorrect: isCorrect,
            correctAnswer: q.correct_answer,
            questionType: q.question_type,
            timestamp: new Date().toISOString(),
        };
        saveAnswers();
        updateProgress();

        if (session.showAnswers) {
            // Show feedback, disable options, show Next/Finish
            document.querySelectorAll(".option-btn").forEach((btn) => {
                const letter = btn.querySelector(".option-letter").textContent;
                btn.classList.add("disabled");
                btn.classList.remove("selected");
                if (letter === q.correct_answer) {
                    btn.classList.add("correct");
                }
                if (letter === selectedOption && !isCorrect) {
                    btn.classList.add("incorrect");
                }
            });
            document.querySelectorAll(".confidence-btn").forEach((b) => b.classList.add("disabled"));
            showFeedback(isCorrect, q.correct_answer);
            submitBtn.style.display = "none";
            showNavigationButtons(currentIndex);
        } else {
            // Auto-advance to next question or show finish
            if (currentIndex < QUESTIONS.length - 1) {
                currentIndex++;
                loadQuestion(currentIndex);
                window.scrollTo({ top: 0, behavior: "smooth" });
            } else {
                // Last question — show finish button
                submitBtn.style.display = "none";
                document.querySelectorAll(".option-btn").forEach((btn) => btn.classList.add("disabled"));
                showNavigationButtons(currentIndex);
            }
        }
    }

    // ============================================================
    // UI Helpers
    // ============================================================
    function showFeedback(isCorrect, correctAnswer) {
        feedback.style.display = "flex";
        feedback.className = "feedback " + (isCorrect ? "correct" : "incorrect");
        feedbackIcon.textContent = isCorrect ? "\u2713" : "\u2717";
        feedbackText.textContent = isCorrect
            ? "Correct!"
            : `Incorrect. The correct answer is ${correctAnswer}.`;
    }

    function showNavigationButtons(index) {
        const isLast = index === QUESTIONS.length - 1;
        const allAnswered =
            Object.keys(answers).filter((k) => answers[k].submitted).length === QUESTIONS.length;

        if (isLast || allAnswered) {
            nextBtn.style.display = isLast ? "none" : "inline-block";
            finishBtn.style.display = "inline-block";
        } else {
            nextBtn.style.display = "inline-block";
            finishBtn.style.display = "none";
        }
    }

    function navigate(direction) {
        const newIndex = currentIndex + direction;
        if (newIndex >= 0 && newIndex < QUESTIONS.length) {
            currentIndex = newIndex;
            loadQuestion(currentIndex);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }

    function updateProgress() {
        const answeredCount = Object.keys(answers).filter((k) => answers[k].submitted).length;
        const total = QUESTIONS.length;
        const pct = total > 0 ? (answeredCount / total) * 100 : 0;
        progressText.textContent = `${answeredCount} / ${total}`;
        progressBar.style.width = pct + "%";
    }

    // ============================================================
    // Finish & Submit to FormSpree
    // ============================================================
    async function handleFinish() {
        const answeredCount = Object.keys(answers).filter((k) => answers[k].submitted).length;
        const correctCount = Object.keys(answers).filter(
            (k) => answers[k].submitted && answers[k].isCorrect
        ).length;
        const accuracy = answeredCount > 0 ? Math.round((correctCount / answeredCount) * 100) : 0;

        // Show completion modal
        document.getElementById("finalAnswered").textContent = answeredCount;
        document.getElementById("finalCorrect").textContent = correctCount;
        document.getElementById("finalAccuracy").textContent = accuracy + "%";
        document.getElementById("completionModal").style.display = "flex";
        document.getElementById("submitStatus").style.display = "block";
        document.getElementById("submitSuccess").style.display = "none";
        document.getElementById("submitError").style.display = "none";

        // Build submission payload
        const payload = {
            user_id: session.userId,
            email: session.userEmail || "",
            sport: sport,
            expertise_years: session.expertiseYears || "",
            expertise_rating: session.expertiseRating || "",
            session_id: session.sessionId,
            started_at: session.startedAt,
            completed_at: new Date().toISOString(),
            total_questions: QUESTIONS.length,
            answered: answeredCount,
            correct: correctCount,
            accuracy: accuracy,
            answers: JSON.stringify(answers),
        };

        // Submit to FormSpree
        try {
            const response = await fetch(FORMSPREE_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                document.getElementById("submitStatus").style.display = "none";
                document.getElementById("submitSuccess").style.display = "block";
                // Clear localStorage after successful submission
                localStorage.removeItem(STORAGE_ANSWERS_KEY);
                localStorage.removeItem(STORAGE_SESSION_KEY);
            } else {
                throw new Error("FormSpree returned " + response.status);
            }
        } catch (err) {
            console.error("Submission error:", err);
            document.getElementById("submitStatus").style.display = "none";
            document.getElementById("submitError").style.display = "block";

            // Setup download fallback (use onclick to avoid stacking listeners)
            document.getElementById("downloadBtn").onclick = function () {
                downloadResults(payload);
            };
        }
    }

    function downloadResults(payload) {
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `bqa_results_${session.userId}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // ============================================================
    // Start
    // ============================================================
    init();
})();
