/**
 * Basketball QA Human Study - Static Quiz Interface
 * Uses localStorage for persistence and FormSpree for submission.
 */

(function () {
    // ============================================================
    // CONFIGURATION - Update this with your FormSpree form ID
    // ============================================================
    const FORMSPREE_URL = "https://formspree.io/f/xkopzyyb";

    // ============================================================
    // State
    // ============================================================
    let currentIndex = 0;
    let answers = {};       // { questionId: { selected, submitted, isCorrect, correctAnswer } }
    let selectedOption = null;
    let selectedConfidence = "sure"; // default
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

    // Pretty names for question types
    const TYPE_DISPLAY_NAMES = {
        "Q1_atomic_action_recognition": "Atomic Action Recognition",
        "Q2_action_sequence": "Action Sequence",
        "Q3_contested_shot": "Contested Shot",
        "Q3_dribble_move": "Dribble Move",
        "Q3_drive_direction": "Drive Direction",
        "Q3_play_type": "Play Type",
        "Q3_shooting_hand": "Shooting Hand",
        "Q3_shot_type": "Shot Type",
        "Q4_spatial_position_non_descriptive": "Spatial Position",
        "Q5_player_name_same_team_update": "Player Name",
        "Q5_player_number_two_team_similar_update": "Player Number & Team",
        "Q5_player_position": "Player Position",
        "Q5_player_skill_level": "Player Skill Level",
        "Q6_current_score_similar": "Current Score",
        "Q6_remaining_time": "Remaining Time",
        "Q6_shot_clock": "Shot Clock",
        "Q6_which_quarter": "Which Quarter",
        "Q6_which_teams": "Which Teams",
    };

    // ============================================================
    // Initialization
    // ============================================================
    function init() {
        // Check session
        const savedSession = localStorage.getItem("bqa_session");
        if (!savedSession) {
            window.location.href = "index.html";
            return;
        }
        session = JSON.parse(savedSession);
        document.getElementById("navUserId").textContent = session.userId;

        // Load saved answers
        const savedAnswers = localStorage.getItem("bqa_answers");
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
            });
        });

        // Auto-save every 30 seconds
        setInterval(saveAnswers, AUTO_SAVE_INTERVAL);
    }

    // ============================================================
    // Persistence
    // ============================================================
    function saveAnswers() {
        localStorage.setItem("bqa_answers", JSON.stringify(answers));
    }

    // ============================================================
    // Video
    // ============================================================
    function getVideoUrl(questionId) {
        const qId = String(questionId);
        if (typeof VIDEO_MAPPING !== "undefined" && VIDEO_MAPPING[qId]) {
            return VIDEO_MAPPING[qId];
        }
        // Fallback: try to find in question data
        const q = QUESTIONS.find((qq) => String(qq.id) === qId);
        if (q && q.video_url) {
            return q.video_url;
        }
        return null;
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
            btn.innerHTML = `
                <span class="option-letter">${opt.letter}</span>
                <span class="option-text">${opt.text}</span>
            `;

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
                if (btn.dataset.confidence === (existingAnswer.confidence || "sure")) {
                    btn.classList.add("active");
                }
            });
        } else {
            // Reset to default "sure"
            selectedConfidence = "sure";
            confBtns.forEach((btn) => {
                btn.classList.remove("active", "disabled");
                if (btn.dataset.confidence === "sure") {
                    btn.classList.add("active");
                }
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
        submitBtn.disabled = false;
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
                localStorage.removeItem("bqa_answers");
                localStorage.removeItem("bqa_session");
            } else {
                throw new Error("FormSpree returned " + response.status);
            }
        } catch (err) {
            console.error("Submission error:", err);
            document.getElementById("submitStatus").style.display = "none";
            document.getElementById("submitError").style.display = "block";

            // Setup download fallback
            document.getElementById("downloadBtn").addEventListener("click", function () {
                downloadResults(payload);
            });
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
