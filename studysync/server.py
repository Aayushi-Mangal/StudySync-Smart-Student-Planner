#!/usr/bin/env python3
"""
StudySync - Smart Student Planner Local Backend Server
Provides:
1. Static file serving (HTML, CSS, JS)
2. Secure Generative AI API Proxy (keeps API keys protected on the backend)
3. Clearly labeled Demo Curriculum Mode when no API key is provided
4. Zero third-party dependencies (runs on Python 3 standard library)
"""

import http.server
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List

PORT = 8000
DIRECTORY = os.path.dirname(os.path.abspath(__file__))


def load_env_file() -> None:
    """Loads environment variables from a local .env file if present."""
    env_path = os.path.join(DIRECTORY, ".env")
    if os.path.exists(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        key, val = line.split("=", 1)
                        os.environ[key.strip()] = val.strip().strip('"').strip("'")
            print("Loaded configuration from local .env file.")
        except Exception as e:
            print(f"Warning: Could not read .env file: {e}", file=sys.stderr)


def get_api_key() -> str:
    """Returns GEMINI_API_KEY from environment, or empty string."""
    return os.environ.get("GEMINI_API_KEY", "").strip()


def call_gemini_api(api_key: str, topic: str, time_minutes: int, difficulty: str) -> Dict[str, Any]:
    """
    Calls Google's Gemini API securely on the backend.
    The client/frontend never receives or touches this API key.
    """
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={api_key}"

    system_instruction = (
        "You are an expert Computer Science and Data Science university tutor. "
        "The user will provide a topic, available study time in minutes, and a difficulty level. "
        "You MUST return a strictly valid JSON object (no markdown, no extra commentary) matching this exact schema:\n"
        "{\n"
        '  "topic": string,\n'
        '  "difficulty": string,\n'
        '  "timeMinutes": number,\n'
        '  "explanation": {\n'
        '    "summary": string,\n'
        '    "analogy": string,\n'
        '    "keyPoints": [string, string, string]\n'
        "  },\n"
        '  "studyPlan": [\n'
        '    {\n'
        '      "phase": string,\n'
        '      "durationMinutes": number,\n'
        '      "priority": "high" | "medium" | "low",\n'
        '      "focus": string,\n'
        '      "tasks": [string, string]\n'
        "    }\n"
        "  ],\n"
        '  "practiceQuestions": [\n'
        '    {\n'
        '      "id": 1,\n'
        '      "question": string,\n'
        '      "answer": string,\n'
        '      "explanation": string\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Make sure the durations in studyPlan sum up exactly to the available study time. "
        "Provide exactly 5 practice questions with clear answers and explanations."
    )

    user_prompt = (
        f"Topic: {topic}\n"
        f"Available Study Time: {time_minutes} minutes\n"
        f"Target Difficulty: {difficulty}\n"
        "Generate the student study guide, prioritized plan, and 5 practice questions now as pure JSON."
    )

    payload = {
        "contents": [
            {
                "parts": [
                    {"text": system_instruction + "\n\n" + user_prompt}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.3,
            "responseMimeType": "application/json"
        }
    }

    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    with urllib.request.urlopen(req, timeout=20) as resp:
        res_data = json.loads(resp.read().decode("utf-8"))
        candidates = res_data.get("candidates", [])
        if not candidates:
            raise ValueError("No response candidate returned by Gemini.")
        text_content = candidates[0]["content"]["parts"][0]["text"]
        # Parse output JSON
        return json.loads(text_content)


def generate_curated_template(topic: str, time_minutes: int, difficulty: str) -> Dict[str, Any]:
    """
    Generates a structured, verified student study plan and practice set.
    Used when no Gemini API key is configured.
    Explicitly labeled as Demo Curriculum Template so users and judges know it's not live AI.
    """
    clean_topic = topic.strip()
    topic_lower = clean_topic.lower()

    # Time budget division across 4 phases
    p1 = max(5, int(time_minutes * 0.25))
    p2 = max(10, int(time_minutes * 0.40))
    p3 = max(5, int(time_minutes * 0.25))
    p4 = max(5, time_minutes - (p1 + p2 + p3))

    # Domain-specific curated packages
    if "binary search" in topic_lower or "bst" in topic_lower or "tree" in topic_lower:
        explanation = {
            "summary": "A Binary Search Tree (BST) is a hierarchical node-based data structure where each node has at most two children. For every node, all values in its left subtree are strictly smaller, and all values in its right subtree are strictly greater.",
            "analogy": "Think of a phone directory or a sorted dictionary: by comparing your search term to the middle entry, you instantly cut the remaining search space in half with every single step.",
            "keyPoints": [
                "Average lookup, insertion, and deletion time complexity is O(log n).",
                "Worst-case time complexity degrades to O(n) if the tree becomes unbalanced (like a linked list).",
                "An In-Order Traversal (Left, Root, Right) of a BST always yields keys in ascending sorted order."
            ]
        }
        study_plan = [
            {
                "phase": "Phase 1: BST Invariant & Pointer Structure",
                "durationMinutes": p1,
                "priority": "high",
                "focus": "Master node representation (value, left, right) and the BST ordering rule.",
                "tasks": [
                    "Draw a sample BST with 7 nodes by hand and verify left < root < right.",
                    "Review pointer manipulation for inserting a new leaf node."
                ]
            },
            {
                "phase": "Phase 2: Search, Insert & Delete Algorithms",
                "durationMinutes": p2,
                "priority": "high",
                "focus": "Trace recursive and iterative algorithms, especially the 3 deletion cases.",
                "tasks": [
                    "Trace node deletion for: (1) leaf node, (2) single child, (3) two children using in-order successor.",
                    "Analyze why unbalanced BSTs degrade to O(n) and compare with balanced trees (AVL/Red-Black)."
                ]
            },
            {
                "phase": "Phase 3: Traversal Patterns (In-Order, Pre-Order, Post-Order)",
                "durationMinutes": p3,
                "priority": "medium",
                "focus": "Understand depth-first search orderings and practical use cases.",
                "tasks": [
                    "Write pseudo-code for recursive In-Order traversal.",
                    "Verify why in-order traversal produces sorted output."
                ]
            },
            {
                "phase": "Phase 4: Synthesis & Self-Assessment",
                "durationMinutes": p4,
                "priority": "low",
                "focus": "Consolidate learning and tackle diagnostic practice questions.",
                "tasks": [
                    "Answer the 5 practice questions below without looking at solutions.",
                    "Summarize BST Big-O complexities on a cheat sheet."
                ]
            }
        ]
        questions = [
            {
                "id": 1,
                "question": "What is the average time complexity for searching an element in a balanced BST containing N nodes?",
                "answer": "O(log n)",
                "explanation": "Because each comparison allows you to eliminate half of the remaining subtrees, similar to binary search on a sorted array."
            },
            {
                "id": 2,
                "question": "Which traversal order on a Binary Search Tree produces values in strictly non-decreasing sorted order?",
                "answer": "In-Order Traversal (Left, Root, Right)",
                "explanation": "Visiting the entire left subtree (smaller values) before the root, and the root before the right subtree (larger values), naturally orders the elements."
            },
            {
                "id": 3,
                "question": "When deleting a node that has two children, what node is typically chosen to replace it?",
                "answer": "Its In-Order Successor (smallest node in the right subtree) or In-Order Predecessor (largest node in the left subtree)",
                "explanation": "These replacement nodes maintain the BST invariant because the in-order successor is greater than all left-subtree nodes and smaller than all remaining right-subtree nodes."
            },
            {
                "id": 4,
                "question": "Under what condition does a basic BST degrade to an O(n) search time complexity?",
                "answer": "When elements are inserted in already sorted or reverse-sorted order, creating a skewed degenerate tree (effectively a linked list).",
                "explanation": "Without self-balancing mechanisms like AVL or Red-Black rotations, sorted insertions continuously chain onto one side only."
            },
            {
                "id": 5,
                "question": "True or False: Every binary tree with depth D has at most 2^D - 1 total nodes.",
                "answer": "True",
                "explanation": "A full binary tree has 2^0 + 2^1 + ... + 2^(D-1) = 2^D - 1 total nodes."
            }
        ]

    elif "dijkstra" in topic_lower or "graph" in topic_lower or "shortest path" in topic_lower:
        explanation = {
            "summary": "Dijkstra's Algorithm finds the shortest path from a single source node to all other nodes in a weighted graph with non-negative edge weights using a greedy strategy and a priority queue (min-heap).",
            "analogy": "Imagine water rippling outward from a dropped pebble: it spreads steadily into the closest channels first, guaranteeing that whenever it reaches a junction, it has traveled the shortest physical route.",
            "keyPoints": [
                "Greedy approach: Always visits the unvisited node with the smallest tentative distance.",
                "Requires non-negative edge weights (fails with negative edge weights; use Bellman-Ford instead).",
                "Time complexity with a Binary Min-Heap is O((V + E) log V)."
            ]
        }
        study_plan = [
            {
                "phase": "Phase 1: Graph Representation & Min-Heap Basics",
                "durationMinutes": p1,
                "priority": "high",
                "focus": "Review adjacency list representation and how min-heaps extract the minimum distance node.",
                "tasks": [
                    "Draw a weighted directed graph with 5 vertices and write its adjacency list.",
                    "Initialize distance array with Infinity and source node with 0."
                ]
            },
            {
                "phase": "Phase 2: Step-by-Step Edge Relaxation",
                "durationMinutes": p2,
                "priority": "high",
                "focus": "Master the relaxation condition: if dist[u] + weight(u, v) < dist[v] then update dist[v].",
                "tasks": [
                    "Trace Dijkstra on paper step-by-step, recording the priority queue contents after each pop.",
                    "Understand why visited nodes are never relaxed again."
                ]
            },
            {
                "phase": "Phase 3: Complexity Analysis & Limitations",
                "durationMinutes": p3,
                "priority": "medium",
                "focus": "Contrast with BFS, Bellman-Ford, and A* search.",
                "tasks": [
                    "Derive why time complexity is O((V + E) log V) using a binary heap.",
                    "Understand why negative edge weights cause Dijkstra's greedy assumption to fail."
                ]
            },
            {
                "phase": "Phase 4: Practice Questions & Review",
                "durationMinutes": p4,
                "priority": "low",
                "focus": "Solve practice questions and test edge-case understanding.",
                "tasks": [
                    "Answer the 5 diagnostic questions below.",
                    "Verify path reconstruction using parent pointers."
                ]
            }
        ]
        questions = [
            {
                "id": 1,
                "question": "What happens if Dijkstra's algorithm is run on a graph with negative edge weights?",
                "answer": "It may yield incorrect shortest paths and fail to terminate correctly if a negative cycle exists.",
                "explanation": "Dijkstra greedily marks nodes as visited assuming their distance can never decrease. Negative edges violate this invariant."
            },
            {
                "id": 2,
                "question": "What is the time complexity of Dijkstra's algorithm implemented with an adjacency list and a binary min-heap?",
                "answer": "O((V + E) log V)",
                "explanation": "Each vertex is extracted from the heap once (V log V), and each edge relaxation may update the heap (E log V)."
            },
            {
                "id": 3,
                "question": "What algorithm should you use if your graph contains negative edge weights?",
                "answer": "The Bellman-Ford Algorithm (or Floyd-Warshall for all-pairs).",
                "explanation": "Bellman-Ford relaxes all edges V-1 times and can detect negative weight cycles."
            },
            {
                "id": 4,
                "question": "What data structure enables Dijkstra's algorithm to efficiently select the next closest unvisited node?",
                "answer": "A Min-Priority Queue (typically backed by a binary heap or Fibonacci heap).",
                "explanation": "A min-heap extracts the minimum distance node in O(log V) time."
            },
            {
                "id": 5,
                "question": "If all edge weights in a graph are identical and equal to 1, what simpler algorithm can replace Dijkstra?",
                "answer": "Standard Breadth-First Search (BFS)",
                "explanation": "For unweighted graphs or uniform edge weights, BFS discovers shortest paths in O(V + E) time without heap overhead."
            }
        ]

    elif "sql" in topic_lower or "join" in topic_lower or "database" in topic_lower:
        explanation = {
            "summary": "Relational database queries combine related tables using JOIN clauses based on shared foreign key relationships. The primary types are INNER JOIN, LEFT (OUTER) JOIN, RIGHT JOIN, and FULL OUTER JOIN.",
            "analogy": "Imagine two sign-up sheets at a hackathon: one for Team Rosters and one for T-Shirt Sizes. An INNER JOIN matches students on both sheets. A LEFT JOIN keeps everyone on the Team Roster even if they haven't filled out their T-shirt size yet.",
            "keyPoints": [
                "INNER JOIN returns only rows that satisfy the matching condition in both tables.",
                "LEFT JOIN returns all rows from the left table, with NULLs for unmatched right-table attributes.",
                "Indexes on foreign key columns significantly accelerate JOIN execution via Index Nested Loops or Hash Joins."
            ]
        }
        study_plan = [
            {
                "phase": "Phase 1: Relational Schema & Primary/Foreign Keys",
                "durationMinutes": p1,
                "priority": "high",
                "focus": "Understand relational integrity and join criteria.",
                "tasks": [
                    "Examine two related tables: Students(id, name, major_id) and Majors(id, title).",
                    "Identify primary key and foreign key references."
                ]
            },
            {
                "phase": "Phase 2: INNER vs OUTER JOIN Mechanics",
                "durationMinutes": p2,
                "priority": "high",
                "focus": "Trace result sets and NULL handling across different join types.",
                "tasks": [
                    "Write SQL queries demonstrating INNER JOIN vs LEFT JOIN.",
                    "Practice finding orphan records using 'WHERE right_table.id IS NULL'."
                ]
            },
            {
                "phase": "Phase 3: Grouping, Aggregations & Multi-Table Joins",
                "durationMinutes": p3,
                "priority": "medium",
                "focus": "Combine JOINs with GROUP BY, COUNT(), and HAVING clauses.",
                "tasks": [
                    "Write a query counting enrolled students per course using LEFT JOIN and GROUP BY.",
                    "Understand Cartesian products (CROSS JOIN) and why ON conditions are critical."
                ]
            },
            {
                "phase": "Phase 4: Quiz & Knowledge Consolidation",
                "durationMinutes": p4,
                "priority": "low",
                "focus": "Review the 5 practice questions and verify conceptual understanding.",
                "tasks": [
                    "Solve the SQL diagnostic questions below.",
                    "Summarize join Venn diagrams and common pitfalls."
                ]
            }
        ]
        questions = [
            {
                "id": 1,
                "question": "What is the key difference between an INNER JOIN and a LEFT JOIN?",
                "answer": "An INNER JOIN returns only matching rows from both tables, while a LEFT JOIN returns all rows from the left table plus matching rows (or NULLs) from the right table.",
                "explanation": "If a row in the left table has no matching foreign key in the right table, INNER JOIN drops it, whereas LEFT JOIN preserves it with NULL column values."
            },
            {
                "id": 2,
                "question": "How do you find all students who are NOT enrolled in any courses using a LEFT JOIN?",
                "answer": "SELECT s.* FROM Students s LEFT JOIN Enrollments e ON s.id = e.student_id WHERE e.student_id IS NULL;",
                "explanation": "The LEFT JOIN keeps all students, and the WHERE clause filters specifically for unmatched entries where right-side fields are NULL."
            },
            {
                "id": 3,
                "question": "What is a CROSS JOIN in SQL?",
                "answer": "A Cartesian product combining every row of the first table with every row of the second table.",
                "explanation": "If table A has M rows and table B has N rows, a CROSS JOIN produces M * N rows."
            },
            {
                "id": 4,
                "question": "Which database index structure is most commonly used to speed up equality JOIN lookups?",
                "answer": "B-Tree (Balanced Tree) Index",
                "explanation": "B-Tree indexes provide O(log n) lookups for matching foreign keys to primary keys."
            },
            {
                "id": 5,
                "question": "What happens if you omit the ON condition in an ANSI SQL JOIN clause?",
                "answer": "It results in a syntax error or produces an accidental Cartesian product (CROSS JOIN).",
                "explanation": "Relational engines require the predicate to know which attributes correspond between tables."
            }
        ]

    else:
        # Dynamic procedural generator for any custom topic
        explanation = {
            "summary": f"{clean_topic} is an essential concept in Computer Science and Data Science. Master the underlying definitions, operational steps, and trade-offs to apply it effectively in projects and exams.",
            "analogy": f"Approaching {clean_topic} is like assembling a modular algorithm: master each fundamental component before chaining them together into complex systems.",
            "keyPoints": [
                f"Identify the core inputs, outputs, and invariants governing {clean_topic}.",
                f"Analyze the computational complexity and performance characteristics under {difficulty.lower()} conditions.",
                "Differentiate theoretical edge cases from practical real-world engineering constraints."
            ]
        }
        study_plan = [
            {
                "phase": f"Phase 1: Foundations & Definitions of {clean_topic}",
                "durationMinutes": p1,
                "priority": "high",
                "focus": f"Grasp core vocabulary, formal definitions, and basic principles of {clean_topic}.",
                "tasks": [
                    f"Read textbook/lecture notes on {clean_topic} and write down key formulas and definitions.",
                    "Identify the primary problem this concept was created to solve."
                ]
            },
            {
                "phase": "Phase 2: Core Mechanics & Deep Dive",
                "durationMinutes": p2,
                "priority": "high",
                "focus": f"Work through step-by-step examples and mathematical/algorithmic proofs at the {difficulty} level.",
                "tasks": [
                    f"Manually trace two end-to-end examples of {clean_topic} on paper.",
                    "Identify failure modes, edge cases, and boundary constraints."
                ]
            },
            {
                "phase": "Phase 3: Practical Implementation & Analysis",
                "durationMinutes": p3,
                "priority": "medium",
                "focus": "Understand time/space complexity, trade-offs, and practical application patterns.",
                "tasks": [
                    f"Analyze performance trade-offs of {clean_topic} compared to alternative techniques.",
                    "Draft brief pseudo-code or schema illustrating the concept."
                ]
            },
            {
                "phase": "Phase 4: Diagnostic Assessment & Synthesis",
                "durationMinutes": p4,
                "priority": "low",
                "focus": "Review flashcards, answer practice questions, and consolidate takeaways.",
                "tasks": [
                    "Complete the 5 self-check practice questions below.",
                    "Write a 3-sentence summary of the topic in your own words."
                ]
            }
        ]
        questions = [
            {
                "id": 1,
                "question": f"What is the primary motivation for studying and applying {clean_topic}?",
                "answer": f"It provides a structured, optimal approach to solving complex problems involving {clean_topic}.",
                "explanation": f"Understanding {clean_topic} allows developers and data scientists to build efficient, scalable solutions with verified correctness."
            },
            {
                "id": 2,
                "question": f"At a {difficulty.lower()} level, what is the most important prerequisite concept needed to master {clean_topic}?",
                "answer": "Strong foundational knowledge of underlying data structures, mathematical logic, and algorithmic invariants.",
                "explanation": f"Complex concepts in {clean_topic} build directly upon core discrete mathematics and basic computational models."
            },
            {
                "id": 3,
                "question": f"What is a common pitfall students encounter when first learning {clean_topic}?",
                "answer": "Focusing solely on rote memorization rather than understanding the underlying invariant and edge-case behaviors.",
                "explanation": "Exam problems and interview questions frequently test edge cases and boundary limits."
            },
            {
                "id": 4,
                "question": f"How do you evaluate whether {clean_topic} is the right approach for a given computational problem?",
                "answer": "By analyzing input constraints, time/space complexity limits, and scalability requirements.",
                "explanation": "Engineering is about trade-offs; choose the approach that best fits latency, memory, and code maintainability needs."
            },
            {
                "id": 5,
                "question": f"In {difficulty.lower()} applications, what trade-off is most frequently balanced when tuning {clean_topic}?",
                "answer": "Time efficiency versus memory consumption (the classic time-space trade-off).",
                "explanation": "Optimizations frequently trade additional caching/memory structures for faster lookup and query latency."
            }
        ]

    return {
        "topic": clean_topic,
        "difficulty": difficulty,
        "timeMinutes": time_minutes,
        "explanation": explanation,
        "studyPlan": study_plan,
        "practiceQuestions": questions
    }


class StudySyncRequestHandler(http.server.SimpleHTTPRequestHandler):
    """Custom HTTP handler serving StudySync assets and the AI Assistant API."""

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=DIRECTORY, **kwargs)

    def end_headers(self):
        # Enable CORS for local development
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)

        # Status endpoint
        if parsed.path == "/api/status":
            api_key = get_api_key()
            has_key = bool(api_key)
            status_data = {
                "status": "online",
                "has_api_key": has_key,
                "model": "gemini-2.5-flash",
                "mode": "live_ai" if has_key else "demo_curated",
                "message": (
                    "Live Google Gemini API connected securely."
                    if has_key
                    else "Running in Demo Curriculum Mode (No API key detected). Responses use verified student curriculum templates."
                )
            }
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(status_data).encode("utf-8"))
            return

        # Fallback to standard static file server
        super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)

        if parsed.path == "/api/generate-study-plan":
            content_length = int(self.headers.get("Content-Length", 0))
            body_bytes = self.rfile.read(content_length)

            try:
                data = json.loads(body_bytes.decode("utf-8"))
            except Exception as e:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": f"Invalid JSON payload: {e}"}).encode("utf-8"))
                return

            topic = str(data.get("topic", "")).strip()
            time_minutes = int(data.get("timeMinutes", 45))
            difficulty = str(data.get("difficulty", "Intermediate")).strip()

            if not topic:
                self.send_response(400)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": "Subject or topic cannot be empty."}).encode("utf-8"))
                return

            # Clamp time between 10 and 300 minutes
            time_minutes = max(10, min(300, time_minutes))
            if difficulty not in ["Beginner", "Intermediate", "Advanced"]:
                difficulty = "Intermediate"

            api_key = get_api_key()

            if api_key:
                try:
                    print(f"Calling live Gemini API for topic: '{topic}'...")
                    gemini_result = call_gemini_api(api_key, topic, time_minutes, difficulty)
                    response_obj = {
                        "success": true_bool(),
                        "is_demo": False,
                        "provider": "Google Gemini (gemini-2.5-flash)",
                        "notice": "Generated via live Google Gemini generative AI.",
                        "data": gemini_result
                    }
                except Exception as ex:
                    print(f"Live Gemini API call failed: {ex}. Falling back to curated template.", file=sys.stderr)
                    template_data = generate_curated_template(topic, time_minutes, difficulty)
                    response_obj = {
                        "success": True,
                        "is_demo": True,
                        "provider": "Curated Student Curriculum Template",
                        "fallback_reason": str(ex),
                        "notice": "Live AI call encountered an issue (check API key/quota). Displaying verified curriculum template.",
                        "data": template_data
                    }
            else:
                # No API key provided -> Return clearly labeled demo curriculum template
                template_data = generate_curated_template(topic, time_minutes, difficulty)
                response_obj = {
                    "success": True,
                    "is_demo": True,
                    "provider": "Curated Student Curriculum Template",
                    "notice": "DEMO MODE: Generated from structured student curriculum templates (No Gemini API key configured).",
                    "data": template_data
                }

            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps(response_obj).encode("utf-8"))
            return

        self.send_response(404)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps({"error": "Endpoint not found"}).encode("utf-8"))


def true_bool():
    return True


def run_server(port=PORT):
    load_env_file()
    api_key = get_api_key()
    print("=" * 60)
    print("StudySync - Smart Student Planner Local Server")
    print("=" * 60)
    print(f"Serving files from: {DIRECTORY}")
    print(f"URL: http://localhost:{port}")
    if api_key:
        print("[AI Mode]: LIVE (Google Gemini API key detected securely on backend)")
    else:
        print("[AI Mode]: DEMO TEMPLATE MODE (No GEMINI_API_KEY set)")
        print("           Responses will be served from structured curriculum templates.")
        print("           To enable live AI, set GEMINI_API_KEY in your environment or .env file.")
    print("=" * 60)

    server_address = ("127.0.0.1", port)
    httpd = http.server.ThreadingHTTPServer(server_address, StudySyncRequestHandler)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server gracefully...")
        httpd.server_close()


if __name__ == "__main__":
    p = PORT
    if len(sys.argv) > 1:
        try:
            p = int(sys.argv[1])
        except ValueError:
            pass
    run_server(p)
