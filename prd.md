# ōrātiō

> formerly Veritas

## Product Requirements Document (PRD)

### Version 3.0

---

# 1. EXECUTIVE SUMMARY

## Product Name

ōrātiō

## Product Category

AI-Native Mobile Communication Training Platform

## Platforms

* iOS
* Android

## Vision

ōrātiō is a voice-first AI communication gym that trains users to think, structure ideas, communicate clearly, persuade effectively, understand complex information, and improve social intelligence through deliberate practice and measurable feedback.

Unlike AI assistants that optimize for conversation, ōrātiō optimizes for skill development.

The core learning loop is:

Challenge → Perform → Evaluate → Retry → Improve

---

# 2. CORE DIFFERENTIATOR

Most speaking apps evaluate speech.

ōrātiō evaluates:

1. Thinking
2. Structure
3. Delivery

Communication is modeled as:

Thought → Structure → Speech

The platform identifies failures at each stage independently.

Example:

Thought Score: 9.1

Structure Score: 4.8

Delivery Score: 6.2

Diagnosis:

"Strong ideas are being lost due to poor organization."

---

TARGET USERS
Researchers
Graduate students
Professionals
Founders
Job seekers
Content creators

# 3. PRODUCT OBJECTIVES

Users should improve:

* Public speaking
* Research communication
* Vocabulary
* Storytelling
* Persuasion
* Reading comprehension
* Interview performance
* Emotional intelligence
* Active listening
* Networking
* Relationship communication
* Critical thinking

---

# 4. SUCCESS METRICS

Primary KPI

Communication IQ Improvement

Measurement:

Day 1 vs Day 30 vs Day 90

---

Secondary KPIs

Average Session Duration

Speaking Minutes Per Week

Retry Rate

Vocabulary Growth

Comprehension Growth

---

# 5. TECH STACK

## Mobile

React Native

Expo

TypeScript

---

## Backend

FastAPI

Python

---

## Database

PostgreSQL

Supabase

---

## Authentication

Supabase Auth

Google Login

Apple Login

Email Login

---

## Storage

Supabase Storage

---

## Vector Memory

pgvector

---

## Analytics

PostHog

---

## Payments

RevenueCat

Stripe

---

## AI

Gemini 2.5 Pro

Gemini Live API

Embedding Model

---

# 6. HIGH LEVEL ARCHITECTURE

Mobile App

↓

FastAPI Backend

↓

Evaluation Service

↓

Gemini API

↓

Scoring Engine

↓

PostgreSQL

↓

Analytics Layer

---

# 7. USER ONBOARDING

Goal:

Create a personalized communication model.

---

Collect:

Name

Profession

Education

Industry

Communication Goals

Weaknesses

Strengths

Speaking Confidence

Reading Level

Vocabulary Level

Primary Use Cases

Examples:

Research

Interviews

Leadership

Relationships

Networking

Sales

---

Create User Profile

Store:

Communication Profile

Learning Profile

Vocabulary Profile

Research Profile

Goal Profile

---

# PHASE 0

THOUGHT GYM

Purpose:

Improve idea generation and reasoning.

---

Module 0.1

Idea Expansion

Prompt (example): 

Why should hospitals invest in MRI?

Evaluation:

Depth

Reasoning

Completeness

Evidence

Insight

---

Module 0.2

Argument Builder

Structure:

Claim

Evidence

Counterargument

Rebuttal

Conclusion

---

Module 0.3

First Principles Thinking

Prompt:

Explain why MRI super-resolution exists.

---

Module 0.4

Mental Models

Prompt:

Explain MRI using an analogy.

---

Module 0.5

Thinking Speed Trainer

Preparation Times:

5 sec

10 sec

30 sec

60 sec

---

Scoring

Thought Score

1-10

Dimensions:

Logic

Reasoning

Depth

Insight

Completeness

Originality

---

# PHASE 0A

RESEARCH COMMUNICATION TRAINER

Specialized module.

---

Target Users

Researchers

PhD Students

Engineers

Scientists

---

Modes

Elevator Pitch

30 sec

---

Conference Pitch

2 min

---

Poster Walkthrough

3 min

---

Paper Summary

5 min

---

Supervisor Update

60 sec

---

Grant Pitch

2 min

---

Layperson Explanation

Explain to:

Child

Patient

Investor

Journalist

---

Evaluation

Technical Accuracy

Conceptual Clarity

Audience Adaptation

Scientific Persuasion

Brevity

Confidence

Structure

Storytelling

---

Personal Research Memory

Store:

Research Topics

Projects

Publications

Keywords

Recurring Concepts

---

# PHASE 1

VOICE FEEDBACK ENGINE

Core Foundation

---

Voice Recording

Record

Pause

Resume

Playback

Delete

Save

---

Speech Recognition

Real-Time

Word Timestamps

Confidence Values

---

Session Pipeline

Record

Transcribe

Analyze

Evaluate

Feedback

Retry

Compare

Save

---

Delivery Score

Categories:

Clarity

Vocabulary

Confidence

Persuasion

Pacing

Engagement

Conciseness

---

Feedback Report

Strengths

Weaknesses

Best Sentence

Worst Sentence

Suggested Rewrite

Retry Challenge

---

# PHASE 2

STRUCTURE GYM

Purpose:

Train organization.

---

Frameworks

PREP

Point

Reason

Example

Point

---

STAR

Situation

Task

Action

Result

---

Scientific

Problem

Gap

Method

Result

Impact

---

Story

Context

Conflict

Resolution

Lesson

---

Pyramid Principle

Conclusion First

Supporting Evidence Later

---

Structure Score

Categories:

Organization

Flow

Hierarchy

Transitions

Redundancy

Completeness

---

# PHASE 3

COMMUNICATION GYM

Purpose:

General communication practice.

---

Modes

Public Speaking

Teaching

Storytelling

Debate

Leadership

Networking

Interview

Relationship Communication

Conflict Resolution

Sales

Persuasion

---

Difficulty Levels

Beginner

Intermediate

Advanced

Expert

---

Training Loop

Prompt

Preparation

Speak

Evaluate

Retry

Compare

Progress

---

# PHASE 4

VOCABULARY ACADEMY

Purpose:

Increase expressive precision.

---

Modules

Word Upgrade

Sentence Upgrade

Academic Rewrite

Professional Rewrite

Persuasive Rewrite

Technical Rewrite

Simplification

---

Track

Vocabulary Range

Unique Vocabulary

Overused Words

Known Words

Unknown Words

---

# PHASE 5

READING COMPREHENSION LAB

Purpose:

Understand complex material.

---

Inputs

PDF

Research Paper

Article

Book Chapter

Report

Essay

---

Pipeline

Upload

Analyze

Simplify

Explain

Quiz

Evaluate

---

Outputs

Summary

Definitions

Key Ideas

Argument Map

Quiz

Comprehension Score

---

# PHASE 6

SOCIAL INTELLIGENCE TRAINER

Knowledge Sources

How to Win Friends and Influence People

Never Split the Difference

Influence

Crucial Conversations

The Charisma Myth

Difficult Conversations

---

Scenarios

Difficult Friend

Relationship Conflict

Negotiation

Networking

Supervisor Conversation

Workplace Conflict

---

Evaluation

Empathy

Listening

Validation

Curiosity

Conflict Management

Persuasion

---

# PHASE 7

PERSONAL COMMUNICATION MODEL

Purpose

Create communication twin.

---

Store

Communication History

Weaknesses

Strengths

Vocabulary

Goals

Career

Research Topics

Preferences

---

Track

Filler Words

Speaking Rate

Confidence

Vocabulary Growth

Storytelling

Persuasion

Listening

---

Detect

Rambling

Jargon

Tangents

Defensiveness

Weak Arguments

Circular Logic

Overexplaining

---

# PHASE 8

COMMUNICATION ANALYTICS

Dashboard

---

Communication IQ

Overall

---

Thought Score

---

Structure Score

---

Delivery Score

---

Comprehension Score

---

Social Intelligence Score

---

Charts

Weekly Growth

Monthly Growth

Yearly Growth

---

Advanced Metrics

Words Per Minute

Unique Vocabulary

Average Sentence Length

Readability

Pause Distribution

Question Usage

Story Usage

Example Usage

---

# PHASE 9

LIVE COACH MODE

Purpose

Real-Time Communication Assistance

---

Modes

Presentation

Interview

Meeting

Networking

Date

Research Defense

Conference

---

Real-Time Detection

Speaking Too Fast

Filler Words

Jargon

Weak Answers

Rambling

---

Interventions

Slow Down

Clarify

Give Example

Answer Directly

Summarize

---

Live Dashboard

Confidence Meter

Clarity Meter

Pacing Meter

Persuasion Meter

---

# PHASE 10

COMMUNICATION REPLAY

Purpose

Reveal communication gaps.

---

Display

What You Said

What You Meant

What Listener Likely Heard

---

Highlight

Misunderstandings

Jargon

Confusing Sections

Lost Opportunities

---

# PHASE 11

AUDIENCE SWITCHING

Explain same idea to:

Child

Patient

Investor

CEO

Professor

Researcher

Friend

---

Evaluation

Adaptability

Vocabulary Selection

Explanation Quality

Audience Awareness

---

# PHASE 12

THESIS DEFENSE SIMULATOR

AI Personas

Reviewer

Professor

Examiner

Industry Researcher

Conference Attendee

---

Track

Confidence

Reasoning

Structure

Persuasion

Technical Accuracy

---

Generate

Follow-Up Questions

Adversarial Questions

Clarification Questions

---

# PHASE 13

THOUGHT MAPPER

Purpose

Visualize reasoning.

---

Generate

Idea Graph

Reasoning Graph

Argument Graph

---

Detect

Missing Logic

Weak Evidence

Circular Reasoning

Unsupported Claims

---

# DATABASE TABLES

users

user_profiles

sessions

audio_files

transcripts

feedback_reports

scores

attempts

communication_metrics

thought_scores

structure_scores

delivery_scores

reading_scores

vocabulary_scores

social_scores

goals

research_topics

memory_embeddings

streaks

achievements

subscriptions

---

# GAMIFICATION

XP

Levels

Badges

Streaks

Achievements

Communication Rank

---

Ranks

Bronze

Silver

Gold

Platinum

Diamond

Master

Grandmaster

---

# FUTURE ROADMAP

Video Analysis

Body Language Analysis

Eye Contact Tracking

Facial Expression Analysis

Mock VC Pitch

Board Meeting Simulator

Negotiation Simulator

Relationship Simulator

Multi-Agent Debate Panel

Communication Certification

Communication IQ Benchmarking

Enterprise Team Version

Coach Marketplace

Custom Training Programs

API Platform

White Label Version

---

# NORTH STAR

ōrātiō should become the world's most effective system for improving how people think, structure ideas, communicate, persuade, and understand others.
