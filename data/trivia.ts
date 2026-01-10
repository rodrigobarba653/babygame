export interface TriviaQuestion {
  id: string
  text: string
  options: [string, string, string, string]
  correctIndex: number
}

export const TRIVIA_QUESTIONS: TriviaQuestion[] = [
  {
    id: '1',
    text: "How many weeks is a typical pregnancy?",
    options: ['38 weeks', '40 weeks', '42 weeks', '36 weeks'],
    correctIndex: 1,
  },
  {
    id: '2',
    text: "What is the average weight of a newborn baby?",
    options: ['5-6 pounds', '7-8 pounds', '9-10 pounds', '11-12 pounds'],
    correctIndex: 1,
  },
  {
    id: '3',
    text: "At what month do babies typically start teething?",
    options: ['2-3 months', '4-6 months', '7-9 months', '10-12 months'],
    correctIndex: 1,
  },
  {
    id: '4',
    text: "What is the most common time for babies to be born?",
    options: ['Morning', 'Afternoon', 'Evening', 'Midnight'],
    correctIndex: 0,
  },
  {
    id: '5',
    text: "How many diapers does a newborn typically go through per day?",
    options: ['6-8', '8-10', '10-12', '12-14'],
    correctIndex: 2,
  },
  {
    id: '6',
    text: "What is the first sense a baby develops?",
    options: ['Sight', 'Hearing', 'Touch', 'Taste'],
    correctIndex: 2,
  },
  {
    id: '7',
    text: "At what age do most babies start walking?",
    options: ['8-10 months', '10-12 months', '12-15 months', '15-18 months'],
    correctIndex: 2,
  },
  {
    id: '8',
    text: "What is the term for a baby's first poop?",
    options: ['Meconium', 'Colostrum', 'Vernix', 'Lanugo'],
    correctIndex: 0,
  },
]

// Use all 8 trivia questions
export const NUM_TRIVIA_QUESTIONS = 8

