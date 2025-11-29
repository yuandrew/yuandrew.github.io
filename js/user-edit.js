// User edit page logic for Christmas Bingo

// Initialize Supabase client
let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
} catch (error) {
    console.error('Failed to initialize Supabase:', error);
    alert('Configuration error. Please contact the administrator.');
}

// Define the 25 bingo tasks
const BINGO_TASKS = [
    { text: "send a picture with you family", type: "photo", isChallenge: false },
    { text: "send a video of you saying something you're thankful for in 2025", type: "video", isChallenge: false },
    { text: "cook your family a meal and record their review", type: "video", isChallenge: false },
    { text: "record yourself calling a friend and telling them you love them", type: "video", isChallenge: false },
    { text: "hold a plank for one full worship song (NO BREAKS)", type: "video", isChallenge: false },
    { text: "record yourself giving someone a present and them opening it", type: "video", isChallenge: false },
    { text: "volunteer somewhere", type: "photo", isChallenge: false },
    { text: "CHALLENGE: Bake the biggest Christmas-shaped cookie (Only 3 biggest cookies can X this square)", type: "photo", isChallenge: true },
    { text: "Do a dramatic reading of Luke 2:1–20", type: "video", isChallenge: false },
    { text: "read a book and add a summary", type: "attestation", isChallenge: false },
    { text: "chug a sparkling water without burping (record whole thing or no credit.)", type: "video", isChallenge: false },
    { text: "CHALLENGE: wrap a gift with oven mitts on (only fastest person can X)", type: "video", isChallenge: true },
    { text: "attend church :)", type: "attestation", isChallenge: false },
    { text: "record yourself doing 25 push ups in a row with Christmas decor behind you 🎄", type: "video", isChallenge: false },
    { text: "go to a Christmas market", type: "photo", isChallenge: false },
    { text: "build a Christmas tree out of objects that aren't a tree", type: "photo", isChallenge: false },
    { text: "make a gingerbread house", type: "photo", isChallenge: false },
    { text: "make a cup of hot cocoa for someone else and record you giving it to them", type: "video", isChallenge: false },
    { text: "take a photo with Santa or a reindeer", type: "photo", isChallenge: false },
    { text: "decorate a Christmas tree and photo with your favorite ornament", type: "photo", isChallenge: false },
    { text: "record yourself singing a Christmas song", type: "video", isChallenge: false },
    { text: "reenact the birth of Jesus using sock puppets", type: "video", isChallenge: false },
    { text: "make a snowman - upload a picture", type: "photo", isChallenge: false },
    { text: "take a photo in Christmas attire (pjs, Santa hat, ugly sweater)", type: "photo", isChallenge: false },
    { text: "CHALLENGE: pose with the coolest Christmas lights (Only top three coolest can X this square)", type: "photo", isChallenge: true }
];

let currentUser = null;
let currentGroupName = null;
let currentUsername = null;
let submissions = [];

// Parse URL to get group name and username
function getPathInfo() {
    const path = window.location.pathname;
    // Expected format: /christmas-bingo/[groupname]/[username]/edit/
    const match = path.match(/\/christmas-bingo\/([^\/]+)\/([^\/]+)\/edit/);
    if (match) {
        return {
            groupName: match[1],
            username: match[2]
        };
    }
    return null;
}

// Initialize page
async function init() {
    const pathInfo = getPathInfo();

    if (!pathInfo) {
        showError('Invalid URL format');
        return;
    }

    currentGroupName = pathInfo.groupName;
    currentUsername = pathInfo.username;

    // Set up navigation links
    document.getElementById('backLink').href = `/christmas-bingo/${currentGroupName}/${currentUsername}/view/`;

    // Set username
    document.getElementById('userName').textContent = currentUsername;

    try {
        // Fetch user data
        const { data: group } = await supabase
            .from('groups')
            .select('id')
            .eq('name', currentGroupName)
            .single();

        if (!group) {
            showError('Group not found');
            return;
        }

        const { data: user } = await supabase
            .from('users')
            .select('id')
            .eq('username', currentUsername)
            .eq('group_id', group.id)
            .single();

        if (!user) {
            showError('User not found');
            return;
        }

        currentUser = user;

        // Fetch submissions
        const { data: userSubmissions, error } = await supabase
            .from('bingo_submissions')
            .select('*')
            .eq('user_id', user.id);

        if (error) {
            console.error('Error fetching submissions:', error);
            showError('Failed to load submissions');
            return;
        }

        submissions = userSubmissions;

        // Render board
        renderBingoBoard();
        updateProgress();

    } catch (error) {
        console.error('Error loading user data:', error);
        showError('Failed to load user data');
    }
}

// Render the bingo board
function renderBingoBoard() {
    const board = document.getElementById('bingoBoard');

    // Create a map of completed squares
    const completedMap = {};
    submissions.forEach(sub => {
        completedMap[sub.square_index] = sub;
    });

    let html = '<div class="bingo-board">';

    BINGO_TASKS.forEach((task, index) => {
        const isCompleted = completedMap.hasOwnProperty(index);
        const squareClass = isCompleted ? 'bingo-square completed' : 'bingo-square';

        html += `
            <div class="${squareClass}" onclick="handleSquareClick(${index})">
                <div class="square-number">${index + 1}</div>
                ${task.isChallenge ? '<div class="challenge-badge">⭐</div>' : ''}
                <div class="square-content">
                    ${escapeHtml(task.text)}
                </div>
            </div>
        `;
    });

    html += '</div>';
    board.innerHTML = html;
}

// Update progress bar
function updateProgress() {
    const completed = submissions.length;
    const total = 25;
    const percentage = (completed / total) * 100;

    document.getElementById('progressBar').style.width = `${percentage}%`;
    document.getElementById('progressText').textContent = `${completed} / ${total}`;
}

// Handle square click
function handleSquareClick(index) {
    const task = BINGO_TASKS[index];
    const submission = submissions.find(sub => sub.square_index === index);

    if (submission) {
        // Square is already completed - show details
        alert(`This task is already completed!\n\nTask: ${task.text}\n\nNote: Full editing functionality will be available in Stage 3.`);
    } else {
        // Square is not completed - prompt to complete
        alert(`Task: ${task.text}\n\nType: ${task.type}\n\nNote: Upload functionality will be available in Stage 3. For now, this is just a preview!`);
    }
}

// Show error
function showError(message) {
    const board = document.getElementById('bingoBoard');
    board.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #c33;">
            <h3>⚠️ Error</h3>
            <p>${escapeHtml(message)}</p>
        </div>
    `;
}

// Escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', init);
