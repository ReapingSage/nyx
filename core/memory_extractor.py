"""
core/memory_extractor.py — Memory Extraction from Conversations

Analyzes natural language to find memory-worthy content and maps it to the
8 root categories of the Memory Constellation.

Only creates memories when clearly stated. Never fabricates. Confidence-scored.
"""

import re
from dataclasses import dataclass, field
from utils.logger import get_logger

log = get_logger(__name__)


@dataclass
class ExtractedMemory:
    label:      str
    category:   str
    confidence: float
    source:     str = "chat"
    tags:       list = field(default_factory=list)


# ── Keyword dictionary ────────────────────────────────────────────────────────
# Format: "lowercase phrase" → (category, clean_label, confidence)

KEYWORDS: dict[str, tuple] = {

    # ── Identity: name, brand, personal goals, personality ───────────────────
    "sagefall":               ("identity",      "Sagefall",               0.92),
    "financial freedom":      ("identity",      "Financial Freedom",      0.88),
    "financial independence": ("identity",      "Financial Independence", 0.88),
    "passive income":         ("identity",      "Passive Income",         0.82),
    "make money online":      ("identity",      "Online Income",          0.75),
    "help others":            ("identity",      "Help Others",            0.78),
    "night owl":              ("identity",      "Night Owl",              0.90),
    "introvert":              ("identity",      "Introverted",            0.88),
    "perfectionist":          ("identity",      "Perfectionist",          0.85),
    "self-taught":            ("identity",      "Self-Taught",            0.85),
    "self taught":            ("identity",      "Self-Taught",            0.85),
    "entrepreneur":           ("identity",      "Entrepreneur",           0.82),

    # ── Projects: Nyx, Sagefall, Discord, apps, business ideas ──────────────
    "build nyx":              ("projects",      "Build NYX",              0.92),
    "nyx os":                 ("projects",      "NYX OS",                 0.92),
    "nyx ai":                 ("projects",      "NYX AI",                 0.90),
    # NOTE: "discord server" lives under relationships below — a dict can't
    # hold the same key twice, and a second entry here would silently win.
    "discord bot":            ("projects",      "Discord Bot",            0.82),
    "voice ai":               ("projects",      "Voice AI",               0.85),
    "obsidian integration":   ("projects",      "Obsidian Integration",   0.82),
    "jarvis":                 ("projects",      "Jarvis System",          0.85),
    "saas":                   ("projects",      "SaaS Product",           0.78),
    "landing page":           ("projects",      "Landing Page",           0.78),
    "open source":            ("projects",      "Open Source Project",    0.75),

    # ── Skills: coding, cybersecurity, design, business, fitness ─────────────
    "python":                 ("skills",        "Python",                 0.82),
    "javascript":             ("skills",        "JavaScript",             0.82),
    "typescript":             ("skills",        "TypeScript",             0.82),
    "react":                  ("skills",        "React",                  0.82),
    "pytorch":                ("skills",        "PyTorch",                0.80),
    "tensorflow":             ("skills",        "TensorFlow",             0.80),
    "linux":                  ("skills",        "Linux",                  0.80),
    "docker":                 ("skills",        "Docker",                 0.80),
    "programming":            ("skills",        "Programming",            0.75),
    "coding":                 ("skills",        "Coding",                 0.75),
    "cybersecurity":          ("skills",        "Cybersecurity",          0.88),
    "cyber security":         ("skills",        "Cybersecurity",          0.88),
    "ethical hacking":        ("skills",        "Ethical Hacking",        0.85),
    "penetration testing":    ("skills",        "Penetration Testing",    0.85),
    "machine learning":       ("skills",        "Machine Learning",       0.85),
    "deep learning":          ("skills",        "Deep Learning",          0.82),
    "artificial intelligence":("skills",        "AI Development",         0.85),
    "large language models":  ("skills",        "LLMs",                   0.82),
    "llms":                   ("skills",        "LLMs",                   0.80),
    "web development":        ("skills",        "Web Development",        0.82),
    "web dev":                ("skills",        "Web Development",        0.80),
    "graphic design":         ("skills",        "Graphic Design",         0.82),
    "ui design":              ("skills",        "UI Design",              0.82),
    "ux design":              ("skills",        "UX Design",              0.82),
    "video editing":          ("skills",        "Video Editing",          0.80),
    "fitness":                ("skills",        "Fitness",                0.75),
    "networking":             ("skills",        "Networking",             0.72),

    # ── Systems: routines, workflows, schedules, productivity ────────────────
    "daily routine":          ("systems",       "Daily Routine",          0.88),
    "morning routine":        ("systems",       "Morning Routine",        0.88),
    "night routine":          ("systems",       "Night Routine",          0.85),
    "sleep schedule":         ("systems",       "Sleep Schedule",         0.85),
    "workflow":               ("systems",       "Workflow",               0.80),
    "productivity system":    ("systems",       "Productivity System",    0.85),
    "time blocking":          ("systems",       "Time Blocking",          0.82),
    "task management":        ("systems",       "Task Management",        0.82),
    "checklist":              ("systems",       "Checklist System",       0.78),
    "second brain":           ("systems",       "Second Brain",           0.85),
    "pomodoro":               ("systems",       "Pomodoro",               0.82),

    # ── Preferences: UI, colors, tone, coding style, design taste ────────────
    "dark mode":              ("preferences",   "Dark Mode",              0.85),
    "dark theme":             ("preferences",   "Dark Theme",             0.85),
    "minimal design":         ("preferences",   "Minimal Design",         0.82),
    "minimalist":             ("preferences",   "Minimalist",             0.80),
    "stoicism":               ("preferences",   "Stoicism",               0.82),
    "philosophy":             ("preferences",   "Philosophy",             0.78),
    "self improvement":       ("preferences",   "Self-Improvement",       0.80),
    "self-improvement":       ("preferences",   "Self-Improvement",       0.80),
    "growth mindset":         ("preferences",   "Growth Mindset",         0.82),
    "astronomy":              ("preferences",   "Astronomy",              0.78),
    "psychology":             ("preferences",   "Psychology",             0.78),
    "neuroscience":           ("preferences",   "Neuroscience",           0.78),

    # ── Events: milestones, decisions, breakthroughs ─────────────────────────
    "breakthrough":           ("events",        "Breakthrough",           0.82),
    "milestone":              ("events",        "Milestone",              0.82),

    # ── Relationships: Discord community, clients, collaborators ─────────────
    "discord community":      ("relationships", "Discord Community",      0.85),
    "discord members":        ("relationships", "Discord Members",        0.82),
    "discord server":         ("relationships", "Discord Server",         0.82),
    "collaborator":           ("relationships", "Collaborator",           0.78),
    "audience":               ("relationships", "Audience",               0.75),

    # ── Vault: manually saved notes, long-term thoughts ──────────────────────
    "discipline":             ("vault",         "Discipline",             0.80),
    "hard work":              ("vault",         "Hard Work",              0.78),
    "honesty":                ("vault",         "Honesty",                0.78),
    "creativity":             ("vault",         "Creativity",             0.78),
    "integrity":              ("vault",         "Integrity",              0.78),
    "loyalty":                ("vault",         "Loyalty",                0.78),
}


# ── Pattern definitions ───────────────────────────────────────────────────────
# Each tuple: (regex, base_confidence). Capture group 1 is the concept text.

PATTERNS: dict[str, list[tuple]] = {

    'identity': [
        # "My name is...", "I go by...", "My brand is..."
        (r"(?:my (?:name is|alias is|brand is|goal is)|i go by|i am known as)\s+([\w][\w\s]{2,50}?)(?:\.|,|$)", 0.80),
        # "I want to / I'm trying to / I hope to..."
        (r"(?:i want to|i'm trying to|i'm aiming to|i hope to|i intend to)\s+([\w][\w\s,]{2,50}?)(?:\.|,|\band\b|$)", 0.70),
        # "I am a night owl / developer / entrepreneur..."
        (r"i(?:'m| am) (?:a |an )?((?:night owl|morning person|introvert|extrovert|perfectionist|gamer|developer|programmer|entrepreneur|student|self-taught|freelancer|designer|creator)[^,.\n]{0,20})", 0.85),
        (r"i(?:'m| am) (?:very |quite |pretty |really |kind of )?((?:introverted|extroverted|analytical|creative|loyal|disciplined|ambitious|curious|determined|focused|driven)[^,.\n]{0,20})", 0.75),
    ],

    'projects': [
        # "I'm building / developing / working on..."
        (r"(?:i(?:'m| am) (?:building|developing|creating|working on|making|designing)|i (?:built|made|created|launched|shipped|released))\s+([\w][\w\s]{2,50}?)(?:\.|,|$)", 0.80),
        (r"(?:working on|developing|building|shipping)\s+([\w][\w\s]{2,40}?)(?:\.|,|$)", 0.65),
        # "My project / app / site called..."
        (r"(?:my (?:project|app|site|website|bot|server|tool|platform|product|game|business)(?: is| called| named)?)\s+([\w][\w\s]{1,40}?)(?:\.|,|$)", 0.78),
    ],

    'skills': [
        # "I'm learning / I know / I'm good at..."
        (r"(?:i(?:'m| am) (?:learning|studying|practicing|getting into)|i (?:know|can|use|code in)|i(?:'m| am) (?:good at|skilled in|experienced in|proficient in))\s+([\w][\w\s./+#]{1,40}?)(?:\.|,|$)", 0.72),
    ],

    'systems': [
        # "My routine / workflow / system..."
        (r"(?:my (?:routine|workflow|system|schedule|process|habit|checklist|ritual)(?: is| includes| involves)?)\s+([\w][\w\s]{2,50}?)(?:\.|,|$)", 0.75),
        (r"(?:every (?:day|morning|night|week) i|i always|my daily)\s+([\w][\w\s]{2,40}?)(?:\.|,|$)", 0.65),
    ],

    'preferences': [
        # "I prefer / I like / I love..."
        (r"(?:i (?:prefer|love|enjoy|favor)|my (?:favorite|preferred|go-to) (?:color|style|theme|tool|font|language|editor))\s+([\w][\w\s,/]{2,50}?)(?:\.|,|$)", 0.72),
        # "I'm into / interested in / passionate about..."
        (r"(?:i(?:'m| am) (?:interested in|into|really into|passionate about|fascinated (?:by|with)))\s+([\w][\w\s,/]{2,50}?)(?:\.|,|$)", 0.70),
        # "I believe in / I value / important to me"
        (r"(?:i (?:believe in|value|care about)|important to me)\s+([\w][\w\s]{2,40}?)(?:\.|,|$)", 0.68),
    ],

    'events': [
        # "I just launched / shipped / finished / achieved..."
        (r"(?:i(?:'ve| have) (?:just|recently|finally) (?:launched|shipped|finished|completed|released|achieved|reached|hit))\s+([\w][\w\s]{2,50}?)(?:\.|,|$)", 0.78),
        (r"(?:i (?:decided to|realized|discovered|learned that))\s+([\w][\w\s]{2,60}?)(?:\.|,|$)", 0.65),
        # "Big decision / moment / milestone..."
        (r"(?:big (?:decision|change|moment|breakthrough)|taught me)\s+([\w][\w\s]{2,60}?)(?:\.|,|$)", 0.68),
    ],

    'relationships': [
        # "My client / community / collaborator..."
        (r"(?:my (?:client|customer|user|member|follower|subscriber|collaborator|partner|community|team))\s+([\w][\w\s]{1,40}?)(?:\.|,|$)", 0.72),
        (r"(?:working with|collaborating with|partnering with)\s+([\w][\w\s]{2,40}?)(?:\.|,|$)", 0.68),
    ],

    'vault': [
        # Explicit save intent
        (r"(?:remember that|note that|don't forget|save this|key insight|important:)\s+([\w][\w\s]{2,60}?)(?:\.|,|$)", 0.78),
        (r"(?:life rule|principle:|always remember|never forget)\s+([\w][\w\s]{2,60}?)(?:\.|,|$)", 0.72),
    ],
}


# ── Text helpers ──────────────────────────────────────────────────────────────

def _clean(text: str) -> str:
    text = re.sub(r'\b(a|an|the|some|about|more|really|very|quite|to|is|be|do|that)\b',
                  ' ', text, flags=re.I)
    text = re.sub(r'\s+', ' ', text).strip().strip('.').strip(',')
    return text[:60]


def _title(text: str) -> str:
    words = text.strip().split()
    small = {'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of'}
    return ' '.join(
        w.capitalize() if i == 0 or w.lower() not in small else w.lower()
        for i, w in enumerate(words)
    )


# ── Core extraction ───────────────────────────────────────────────────────────

def extract(text: str) -> list[ExtractedMemory]:
    """
    Extract memory candidates from a single piece of text.
    Returns list of ExtractedMemory — never empty fabrications.
    """
    if not text or len(text.strip()) < 8:
        return []

    found:       list[ExtractedMemory] = []
    seen_labels: set[str]              = set()
    text_lower = text.lower()

    # Tier 1: Direct keyword scan (fast, high precision)
    for kw, (cat, label, conf) in KEYWORDS.items():
        if kw in text_lower:
            key = label.lower()
            if key not in seen_labels:
                found.append(ExtractedMemory(label=label, category=cat, confidence=conf))
                seen_labels.add(key)

    # Tier 2: Pattern matching
    for category, patterns in PATTERNS.items():
        for pattern, base_conf in patterns:
            for m in re.finditer(pattern, text, re.I):
                raw = _clean(m.group(1))
                if len(raw) < 3:
                    continue
                label = _title(raw)
                key   = label.lower()
                if key in seen_labels:
                    continue
                if any(key in sl or sl in key for sl in seen_labels if abs(len(sl) - len(key)) < 5):
                    continue
                found.append(ExtractedMemory(label=label, category=category, confidence=base_conf))
                seen_labels.add(key)

    found = [m for m in found if m.confidence >= 0.55 and len(m.label) >= 3]
    return found[:8]


def extract_and_save(text: str, source: str = "chat") -> list[dict]:
    """Extract memories and persist them. Strengthens co-mention edges."""
    from core.constellation_manager import constellation

    memories = extract(text)
    if not memories:
        return []

    saved = []
    for mem in memories:
        node = constellation.add_memory(
            label=mem.label,
            category=mem.category,
            confidence=mem.confidence,
            source=source,
            tags=mem.tags,
        )
        if node.get('id'):
            saved.append(node)

    for i in range(len(saved)):
        for j in range(i + 1, min(i + 4, len(saved))):
            constellation.add_edge(saved[i]['id'], saved[j]['id'])

    if saved:
        log.info(f"[extractor] Extracted {len(saved)} memories from '{text[:60]}...'")

    return saved


def scan_vault_memory_files() -> list[dict]:
    """
    Parse NYX_VAULT/Memory/*.md bullet points and import them as memories.
    Category is inferred directly from the filename — no NLP needed.
    """
    from core import vault_bridge
    from core.constellation_manager import constellation

    # Map md filename stem → constellation category
    FILE_CAT: dict[str, str] = {
        'identity':      'identity',
        'projects':      'projects',
        'skills':        'skills',
        'systems':       'systems',
        'preferences':   'preferences',
        'events':        'events',
        'relationships': 'relationships',
        'vault_notes':   'vault',
        'auto':          'vault',
        'manual':        'vault',
    }

    # Strip markdown bold timestamps like "**2026-05-18 12:30:** " or "[category] "
    _STRIP = re.compile(
        r'^\*\*[\d\-: ]+\*\*:?\s*'      # bold timestamp
        r'|\[[\w/ ]+\]\s*'               # [category] bracket
        r'|—\s*',                        # em-dash prefix
    )

    memory_dir = vault_bridge.get_memory_dir()
    if not memory_dir.exists():
        return []

    saved = []
    for md_file in sorted(memory_dir.glob("*.md")):
        stem = md_file.stem.lower()
        category = FILE_CAT.get(stem, 'vault')
        try:
            lines = md_file.read_text(encoding='utf-8-sig').splitlines()
            for line in lines:
                line = line.strip()
                if not line.startswith('- ') and not line.startswith('* '):
                    continue
                text = line[2:].strip()
                # Strip leading bold timestamp / bracket annotations
                text = _STRIP.sub('', text).strip()
                # Remove trailing parenthetical confidence hints
                text = re.sub(r'\s*\(.*?\)\s*$', '', text).strip()
                if len(text) < 3 or len(text) > 80:
                    continue
                label = _title(text)
                node = constellation.add_memory(
                    label=label,
                    category=category,
                    description="",
                    source="vault",
                    confidence=0.82,
                    importance=3,
                )
                if node.get('id'):
                    saved.append(node)
        except Exception as e:
            log.warning(f"[extractor] Could not scan vault file {md_file.name}: {e}")

    if saved:
        log.info(f"[extractor] Imported {len(saved)} memories from vault memory files.")
    return saved


def scan_conversation_logs() -> list[dict]:
    """Scan vault Memory files + conversation logs and extract new memories."""
    import json
    from pathlib import Path

    all_new = []

    # Scan vault Memory/*.md files first (direct import, no NLP)
    all_new.extend(scan_vault_memory_files())

    CONV_DIR = Path(__file__).parent.parent / "memory" / "conversations"
    if CONV_DIR.exists():
        for log_file in sorted(CONV_DIR.glob("*.json")):
            try:
                entries = json.loads(log_file.read_text(encoding='utf-8'))
                for entry in entries:
                    user_text = entry.get('user', '')
                    if user_text:
                        new = extract_and_save(user_text, source="chat")
                        all_new.extend(new)
            except Exception as e:
                log.warning(f"[extractor] Could not scan {log_file.name}: {e}")

    # Also scan vault conversation logs
    from core import vault_bridge
    logs_dir = vault_bridge.get_logs_dir()
    if logs_dir.exists():
        for md_file in logs_dir.glob("*.md"):
            try:
                content = md_file.read_text(encoding='utf-8')
                lines = [l for l in content.split('\n') if l.startswith('**You:**')]
                for line in lines:
                    user_text = line.replace('**You:**', '').strip()
                    if user_text:
                        new = extract_and_save(user_text, source="vault")
                        all_new.extend(new)
            except Exception as e:
                log.warning(f"[extractor] Could not scan vault log {md_file.name}: {e}")

    # Deduplicate by id
    seen_ids: set[str] = set()
    unique = []
    for n in all_new:
        if n.get('id') not in seen_ids:
            seen_ids.add(n['id'])
            unique.append(n)

    return unique
