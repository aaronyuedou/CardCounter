"use client"

import { useState, useCallback, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import {
  RotateCcw,
  Plus,
  Minus,
  DollarSign,
  Percent,
  TrendingUp,
  Target,
  Zap,
  ArrowRight,
  Hash,
  Play,
  Pause,
  BarChart3,
} from "lucide-react"

type CardValue = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A"
type Action = "HIT" | "STAND" | "DOUBLE" | "SPLIT"
type SimulationStrategy = "basic" | "ai" | "advanced"
type BettingStrategy = "flat" | "kelly" | "progressive"

interface CardCount {
  [key: string]: number
}

interface PlayerHand {
  cards: CardValue[]
  total: number
  isSoft: boolean
}

interface SimulationResult {
  handsPlayed: number
  handsWon: number
  handsLost: number
  handsPushed: number
  totalWagered: number
  totalWon: number
  netProfit: number
  winRate: number
  roi: number
  maxDrawdown: number
  finalBankroll: number
}

interface SimulationHand {
  handNumber: number
  playerCards: CardValue[]
  dealerCards: CardValue[]
  playerTotal: number
  dealerTotal: number
  action: Action
  betAmount: number
  result: "win" | "loss" | "push"
  profit: number
  runningBankroll: number
  trueCount: number
}

const CARD_VALUES: CardValue[] = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]

const HI_LO_VALUES: { [key in CardValue]: number } = {
  "2": 1,
  "3": 1,
  "4": 1,
  "5": 1,
  "6": 1,
  "7": 0,
  "8": 0,
  "9": 0,
  "10": -1,
  J: -1,
  Q: -1,
  K: -1,
  A: -1,
}

export default function BlackjackCardCounter() {
  const [deckCount, setDeckCount] = useState(6)
  const [cardCounts, setCardCounts] = useState<CardCount>(() => {
    const initial: CardCount = {}
    CARD_VALUES.forEach((card) => {
      initial[card] = deckCount * 4
    })
    return initial
  })
  const [playerCards, setPlayerCards] = useState<CardValue[]>([])
  const [dealerCard, setDealerCard] = useState<CardValue | null>(null)
  const [runningCount, setRunningCount] = useState(0)
  const [playerBalance, setPlayerBalance] = useState(1000)
  const [currentRound, setCurrentRound] = useState(1)
  const [roundHistory, setRoundHistory] = useState<
    Array<{
      round: number
      playerTotal: number
      dealerCard: CardValue | null
      action: Action
      winProbability: number
      optimalBet: number
    }>
  >([])

  // Simulation state
  const [isSimulating, setIsSimulating] = useState(false)
  const [simulationProgress, setSimulationProgress] = useState(0)
  const [simulationResults, setSimulationResults] = useState<SimulationResult | null>(null)
  const [simulationHands, setSimulationHands] = useState<SimulationHand[]>([])
  const [simulationConfig, setSimulationConfig] = useState({
    handsToSimulate: 1000,
    strategy: "ai" as SimulationStrategy,
    bettingStrategy: "kelly" as BettingStrategy,
    initialBankroll: 1000,
    minBet: 5,
    maxBet: 100,
  })

  // Add a new state variable for tracking simulator expansion state near the other state variables
  const [isSimulatorExpanded, setIsSimulatorExpanded] = useState(false)

  // Add a toggle function for the simulator expansion
  const toggleSimulator = () => {
    setIsSimulatorExpanded((prev) => !prev)
  }

  const resetGame = useCallback(() => {
    const initial: CardCount = {}
    CARD_VALUES.forEach((card) => {
      initial[card] = deckCount * 4
    })
    setCardCounts(initial)
    setPlayerCards([])
    setDealerCard(null)
    setRunningCount(0)
    setCurrentRound(1)
    setRoundHistory([])
  }, [deckCount])

  const nextRound = useCallback(() => {
    if (playerCards.length > 0 && dealerCard) {
      const winProb = calculateWinProbability()
      const optBet = calculateOptimalBet() // This now calculates based on count, not hand
      const action = getAIRecommendation()

      setRoundHistory((prev) => [
        ...prev,
        {
          round: currentRound,
          playerTotal: calculateHandValue(playerCards).total,
          dealerCard: dealerCard,
          action: action,
          winProbability: winProb,
          optimalBet: optBet,
        },
      ])
    }

    setPlayerCards([])
    setDealerCard(null)
    setCurrentRound((prev) => prev + 1)
  }, [playerCards, dealerCard, currentRound])

  const addCard = useCallback(
    (card: CardValue) => {
      if (cardCounts[card] > 0) {
        setCardCounts((prev) => ({
          ...prev,
          [card]: prev[card] - 1,
        }))
        setRunningCount((prev) => prev + HI_LO_VALUES[card])
      }
    },
    [cardCounts],
  )

  const addPlayerCard = useCallback(
    (card: CardValue) => {
      if (cardCounts[card] > 0) {
        setPlayerCards((prev) => [...prev, card])
        addCard(card)
      }
    },
    [cardCounts, addCard],
  )

  const setDealerUpCard = useCallback(
    (card: CardValue) => {
      if (cardCounts[card] > 0) {
        setDealerCard(card)
        addCard(card)
      }
    },
    [cardCounts, addCard],
  )

  const removePlayerCard = useCallback(
    (index: number) => {
      const card = playerCards[index]
      setPlayerCards((prev) => prev.filter((_, i) => i !== index))
      setCardCounts((prev) => ({
        ...prev,
        [card]: prev[card] + 1,
      }))
      setRunningCount((prev) => prev - HI_LO_VALUES[card])
    },
    [playerCards],
  )

  const clearDealerCard = useCallback(() => {
    if (dealerCard) {
      setCardCounts((prev) => ({
        ...prev,
        [dealerCard]: prev[dealerCard] + 1,
      }))
      setRunningCount((prev) => prev - HI_LO_VALUES[dealerCard])
      setDealerCard(null)
    }
  }, [dealerCard])

  const totalCardsRemaining = useMemo(() => {
    return Object.values(cardCounts).reduce((sum, count) => sum + count, 0)
  }, [cardCounts])

  const trueCount = useMemo(() => {
    const decksRemaining = totalCardsRemaining / 52
    return decksRemaining > 0 ? runningCount / decksRemaining : 0
  }, [runningCount, totalCardsRemaining])

  const getCardValue = (card: CardValue): number => {
    if (card === "A") return 11
    if (["J", "Q", "K"].includes(card)) return 10
    return Number.parseInt(card)
  }

  const calculateHandValue = (cards: CardValue[]): { total: number; isSoft: boolean } => {
    let total = 0
    let aces = 0

    for (const card of cards) {
      if (card === "A") {
        aces++
        total += 11
      } else {
        total += getCardValue(card)
      }
    }

    while (total > 21 && aces > 0) {
      total -= 10
      aces--
    }

    return { total, isSoft: aces > 0 }
  }

  const playerHand = useMemo(() => calculateHandValue(playerCards), [playerCards])

  const getBasicStrategy = (playerTotal: number, dealerUpCard: number, isSoft: boolean, canDouble = true): Action => {
    // Soft hands (with Ace counted as 11)
    if (isSoft) {
      if (playerTotal >= 19) return "STAND"
      if (playerTotal === 18) {
        if (canDouble && dealerUpCard >= 2 && dealerUpCard <= 6) return "DOUBLE"
        if (dealerUpCard === 7 || dealerUpCard === 8) return "STAND"
        return "HIT" // vs 9, 10, A
      }
      if (playerTotal === 17) {
        if (canDouble && dealerUpCard >= 3 && dealerUpCard <= 6) return "DOUBLE"
        return "HIT"
      }
      if (playerTotal === 16 || playerTotal === 15) {
        if (canDouble && dealerUpCard >= 4 && dealerUpCard <= 6) return "DOUBLE"
        return "HIT"
      }
      if (playerTotal === 14 || playerTotal === 13) {
        if (canDouble && dealerUpCard >= 5 && dealerUpCard <= 6) return "DOUBLE"
        return "HIT"
      }
      return "HIT" // A,A through A,6
    }

    // Hard hands
    if (playerTotal >= 17) return "STAND"
    if (playerTotal >= 13) return dealerUpCard <= 6 ? "STAND" : "HIT"
    if (playerTotal === 12) return dealerUpCard >= 4 && dealerUpCard <= 6 ? "STAND" : "HIT"
    if (canDouble && playerTotal === 11) return "DOUBLE"
    if (canDouble && playerTotal === 10) return dealerUpCard <= 9 ? "DOUBLE" : "HIT"
    if (canDouble && playerTotal === 9) return dealerUpCard >= 3 && dealerUpCard <= 6 ? "DOUBLE" : "HIT"

    return "HIT"
  }

  const getBasicStrategyForCurrentHand = (): Action => {
    if (playerCards.length === 0 || !dealerCard) return "STAND"
    const dealerValue = getCardValue(dealerCard)
    const { total, isSoft } = playerHand
    const canDouble = playerCards.length === 2 // Can only double on first 2 cards
    return getBasicStrategy(total, dealerValue, isSoft, canDouble)
  }

  const getAIRecommendation = (): Action => {
    const basicAction = getBasicStrategyForCurrentHand()

    if (trueCount >= 2) {
      if (playerHand.total === 16 && getCardValue(dealerCard!) === 10) return "STAND"
      if (playerHand.total === 15 && getCardValue(dealerCard!) === 10) return "STAND"
      if (playerHand.total === 12 && getCardValue(dealerCard!) >= 2 && getCardValue(dealerCard!) <= 3) return "STAND"
      if (playerHand.total === 10 && getCardValue(dealerCard!) === 10) return "DOUBLE"
      if (playerHand.total === 9 && getCardValue(dealerCard!) === 2) return "DOUBLE"
    } else if (trueCount <= -2) {
      if (playerHand.total === 12 && getCardValue(dealerCard!) >= 4 && getCardValue(dealerCard!) <= 6) return "HIT"
      if (playerHand.total === 13 && getCardValue(dealerCard!) === 2) return "HIT"
    }

    return basicAction
  }

  const calculateWinProbability = (): number => {
    if (playerCards.length === 0 || !dealerCard) return 0

    const dealerValue = getCardValue(dealerCard)
    const { total, isSoft } = playerHand

    let baseProb = 0

    if (playerCards.length === 2 && total === 21) {
      return 0.9
    }

    if (total > 21) {
      return 0
    }

    if (total >= 17) {
      if (dealerValue >= 7) {
        baseProb = 0.4 + (total - 17) * 0.05
      } else {
        baseProb = 0.6 + (total - 17) * 0.05
      }
    } else if (total >= 12) {
      if (dealerValue >= 7) {
        baseProb = 0.25 + (total - 12) * 0.03
      } else {
        baseProb = 0.45 + (total - 12) * 0.03
      }
    } else {
      baseProb = 0.4
    }

    if (isSoft) {
      baseProb += 0.05
    }

    const countAdjustment = trueCount * 0.01
    const highCards = cardCounts["10"] + cardCounts["J"] + cardCounts["Q"] + cardCounts["K"] + cardCounts["A"]
    const highCardRatio = highCards / totalCardsRemaining
    const expectedHighCardRatio = 20 / 52
    const highCardAdjustment = (highCardRatio - expectedHighCardRatio) * 0.5

    const finalProb = baseProb + countAdjustment + highCardAdjustment

    return Math.max(0, Math.min(1, finalProb))
  }

  const calculateOptimalBet = (): number => {
    // Calculate advantage based on true count
    // Each +1 true count gives approximately 0.5% player advantage
    const advantage = trueCount * 0.005

    if (advantage <= 0) {
      return 5 // Minimum bet when no advantage
    }

    // Kelly Criterion for blackjack: f = advantage / variance
    // Blackjack variance is approximately 1.3
    const kellyFraction = advantage / 1.3

    // Use fractional Kelly (1/4 Kelly) for safety
    const fractionalKelly = kellyFraction * 0.25

    let betSize = playerBalance * fractionalKelly
    betSize = Math.max(5, betSize) // Minimum bet
    betSize = Math.min(betSize, playerBalance * 0.1) // Max 10% of bankroll
    betSize = Math.min(betSize, 100) // Reasonable max bet

    return Math.round(betSize / 5) * 5 // Round to nearest $5
  }

  // Fixed simulation functions
  const drawRandomCard = (availableCards: CardCount): CardValue | null => {
    const totalCards = Object.values(availableCards).reduce((sum, count) => sum + count, 0)
    if (totalCards === 0) return null

    let randomIndex = Math.floor(Math.random() * totalCards)

    for (const [card, count] of Object.entries(availableCards)) {
      if (randomIndex < count) {
        return card as CardValue
      }
      randomIndex -= count
    }

    return null
  }

  const simulateHand = (
    initialCardCounts: CardCount,
    initialRunningCount: number,
    bankroll: number,
    strategy: SimulationStrategy,
    bettingStrategy: BettingStrategy,
  ): { result: SimulationHand; newCardCounts: CardCount; newRunningCount: number } => {
    // Create copies to avoid mutation
    const simCardCounts = { ...initialCardCounts }
    let simRunningCount = initialRunningCount

    // Validate we have enough cards
    let totalCards = Object.values(simCardCounts).reduce((sum, count) => sum + count, 0)
    if (totalCards < 4) {
      throw new Error("Not enough cards to deal a hand")
    }

    // Draw player cards
    const playerCards: CardValue[] = []
    const dealerCards: CardValue[] = []

    // Player gets 2 cards
    for (let i = 0; i < 2; i++) {
      const card = drawRandomCard(simCardCounts)
      if (!card) throw new Error("No cards available")
      playerCards.push(card)
      simCardCounts[card]--
      simRunningCount += HI_LO_VALUES[card]
    }

    // Dealer gets 2 cards (one up, one down)
    for (let i = 0; i < 2; i++) {
      const card = drawRandomCard(simCardCounts)
      if (!card) throw new Error("No cards available")
      dealerCards.push(card)
      simCardCounts[card]--
      simRunningCount += HI_LO_VALUES[card]
    }

    const playerHandValue = calculateHandValue(playerCards)
    const dealerUpCard = dealerCards[0]
    const dealerUpValue = getCardValue(dealerUpCard)

    // Calculate true count for betting
    totalCards = Object.values(simCardCounts).reduce((sum, count) => sum + count, 0)
    const decksRemaining = totalCards / 52
    const currentTrueCount = decksRemaining > 0 ? simRunningCount / decksRemaining : 0

    // Calculate bet amount - CORRECTED KELLY CRITERION
    let betAmount = simulationConfig.minBet
    if (bettingStrategy === "kelly") {
      const advantage = currentTrueCount * 0.005 // 0.5% per true count
      if (advantage > 0) {
        const kellyFraction = advantage / 1.3 // Blackjack variance ≈ 1.3
        const fractionalKelly = kellyFraction * 0.25 // Quarter Kelly for safety
        betAmount = simulationConfig.minBet + (simulationConfig.maxBet - simulationConfig.minBet) * fractionalKelly
        betAmount = Math.min(betAmount, simulationConfig.maxBet)
      }
    } else if (bettingStrategy === "progressive") {
      if (currentTrueCount >= 3) betAmount = simulationConfig.minBet * 3
      else if (currentTrueCount >= 2) betAmount = simulationConfig.minBet * 2
      else if (currentTrueCount >= 1) betAmount = simulationConfig.minBet * 1.5
    }

    betAmount = Math.min(betAmount, bankroll, simulationConfig.maxBet)
    betAmount = Math.max(simulationConfig.minBet, betAmount)

    // Get strategy decision
    const canDouble = playerCards.length === 2
    let action: Action = getBasicStrategy(playerHandValue.total, dealerUpValue, playerHandValue.isSoft, canDouble)

    // Apply count-based deviations for AI strategy
    if (strategy === "ai" || strategy === "advanced") {
      if (currentTrueCount >= 2) {
        if (playerHandValue.total === 16 && dealerUpValue === 10) action = "STAND"
        if (playerHandValue.total === 15 && dealerUpValue === 10) action = "STAND"
        if (playerHandValue.total === 12 && dealerUpValue >= 2 && dealerUpValue <= 3) action = "STAND"
      } else if (currentTrueCount <= -2) {
        if (playerHandValue.total === 12 && dealerUpValue >= 4 && dealerUpValue <= 6) action = "HIT"
        if (playerHandValue.total === 13 && dealerUpValue === 2) action = "HIT"
      }
    }

    // Simulate hand outcome
    let playerFinalTotal = playerHandValue.total
    const finalPlayerCards = [...playerCards]

    // Player hits if action is HIT and not busted
    if (action === "HIT" && playerFinalTotal < 21) {
      const hitCard = drawRandomCard(simCardCounts)
      if (hitCard) {
        finalPlayerCards.push(hitCard)
        simCardCounts[hitCard]--
        simRunningCount += HI_LO_VALUES[hitCard]
        playerFinalTotal = calculateHandValue(finalPlayerCards).total
      }
    }

    // Handle DOUBLE (simplified - just hit once and double bet)
    if (action === "DOUBLE") {
      betAmount *= 2
      betAmount = Math.min(betAmount, bankroll) // Can't bet more than bankroll
      const hitCard = drawRandomCard(simCardCounts)
      if (hitCard) {
        finalPlayerCards.push(hitCard)
        simCardCounts[hitCard]--
        simRunningCount += HI_LO_VALUES[hitCard]
        playerFinalTotal = calculateHandValue(finalPlayerCards).total
      }
    }

    // Dealer plays (hits on soft 17) - CORRECTED VERSION
    let dealerFinalTotal = calculateHandValue(dealerCards).total
    const finalDealerCards = [...dealerCards]

    let dealerHitCount = 0
    while (true) {
      const dealerHand = calculateHandValue(finalDealerCards)
      dealerFinalTotal = dealerHand.total

      // Safety check to prevent infinite loops
      if (dealerHitCount > 10) break

      // Dealer stands on hard 17+ and soft 18+
      // Dealer hits on soft 17 and anything less than 17
      if (dealerFinalTotal >= 18) break
      if (dealerFinalTotal === 17 && !dealerHand.isSoft) break

      const hitCard = drawRandomCard(simCardCounts)
      if (!hitCard) break
      finalDealerCards.push(hitCard)
      simCardCounts[hitCard]--
      simRunningCount += HI_LO_VALUES[hitCard]

      dealerHitCount++
    }

    // Determine result
    let result: "win" | "loss" | "push" = "loss"
    let profit = -betAmount

    // Check for blackjacks first
    const playerBlackjack = finalPlayerCards.length === 2 && playerFinalTotal === 21
    const dealerBlackjack = finalDealerCards.length === 2 && dealerFinalTotal === 21

    if (playerBlackjack && dealerBlackjack) {
      result = "push"
      profit = 0
    } else if (playerBlackjack) {
      result = "win"
      profit = betAmount * 1.5 // 3:2 payout for blackjack
    } else if (dealerBlackjack) {
      result = "loss"
      profit = -betAmount
    } else if (playerFinalTotal > 21) {
      result = "loss"
      profit = -betAmount
    } else if (dealerFinalTotal > 21) {
      result = "win"
      profit = betAmount
    } else if (playerFinalTotal > dealerFinalTotal) {
      result = "win"
      profit = betAmount
    } else if (playerFinalTotal === dealerFinalTotal) {
      result = "push"
      profit = 0
    } else {
      result = "loss"
      profit = -betAmount
    }

    return {
      result: {
        handNumber: 0, // Will be set by caller
        playerCards: finalPlayerCards,
        dealerCards: finalDealerCards,
        playerTotal: playerFinalTotal,
        dealerTotal: dealerFinalTotal,
        action,
        betAmount,
        result,
        profit,
        runningBankroll: 0, // Will be set by caller
        trueCount: currentTrueCount,
      },
      newCardCounts: simCardCounts,
      newRunningCount: simRunningCount,
    }
  }

  const runSimulation = async () => {
    setIsSimulating(true)
    setSimulationProgress(0)
    setSimulationHands([])
    setSimulationResults(null)

    try {
      const results: SimulationHand[] = []

      // Initialize simulation state
      let simCardCounts: CardCount = {}
      CARD_VALUES.forEach((card) => {
        simCardCounts[card] = deckCount * 4
      })

      let simRunningCount = 0
      let currentBankroll = simulationConfig.initialBankroll
      let maxBankroll = currentBankroll
      let maxDrawdown = 0

      let handsWon = 0
      let handsLost = 0
      let handsPushed = 0
      let totalWagered = 0
      let totalWon = 0

      for (let i = 0; i < simulationConfig.handsToSimulate; i++) {
        // Check if we need to reshuffle (less than 25% cards remaining)
        const totalCards = Object.values(simCardCounts).reduce((sum, count) => sum + count, 0)
        if (totalCards < deckCount * 52 * 0.25) {
          // Reshuffle
          simCardCounts = {}
          CARD_VALUES.forEach((card) => {
            simCardCounts[card] = deckCount * 4
          })
          simRunningCount = 0
        }

        if (currentBankroll < simulationConfig.minBet) {
          console.log(`Simulation ended early - bankrupt at hand ${i + 1}`)
          break // Bankrupt
        }

        try {
          const handResult = simulateHand(
            simCardCounts,
            simRunningCount,
            currentBankroll,
            simulationConfig.strategy,
            simulationConfig.bettingStrategy,
          )

          simCardCounts = handResult.newCardCounts
          simRunningCount = handResult.newRunningCount
          currentBankroll += handResult.result.profit

          handResult.result.handNumber = i + 1
          handResult.result.runningBankroll = currentBankroll

          if (handResult.result.result === "win") handsWon++
          else if (handResult.result.result === "loss") handsLost++
          else handsPushed++

          totalWagered += handResult.result.betAmount
          if (handResult.result.profit > 0) totalWon += handResult.result.profit + handResult.result.betAmount

          maxBankroll = Math.max(maxBankroll, currentBankroll)
          const drawdown = maxBankroll - currentBankroll
          maxDrawdown = Math.max(maxDrawdown, drawdown)

          results.push(handResult.result)

          // Update progress every 50 hands
          if (i % 50 === 0) {
            setSimulationProgress(((i + 1) / simulationConfig.handsToSimulate) * 100)
            // Yield control to keep UI responsive
            await new Promise((resolve) => setTimeout(resolve, 1))
          }
        } catch (error) {
          console.error(`Error in hand ${i + 1}:`, error)
          break
        }
      }

      const finalResults: SimulationResult = {
        handsPlayed: results.length,
        handsWon,
        handsLost,
        handsPushed,
        totalWagered,
        totalWon,
        netProfit: currentBankroll - simulationConfig.initialBankroll,
        winRate: results.length > 0 ? handsWon / results.length : 0,
        roi: ((currentBankroll - simulationConfig.initialBankroll) / simulationConfig.initialBankroll) * 100,
        maxDrawdown,
        finalBankroll: currentBankroll,
      }

      setSimulationResults(finalResults)
      setSimulationHands(results.slice(-100)) // Keep last 100 hands for display
      setSimulationProgress(100)

      console.log("Simulation completed:", finalResults)
    } catch (error) {
      console.error("Simulation error:", error)
    } finally {
      setIsSimulating(false)
    }
  }

  const winProbability = useMemo(() => {
    return calculateWinProbability()
  }, [playerCards, dealerCard, trueCount, cardCounts, totalCardsRemaining])

  const optimalBet = useMemo(() => {
    return calculateOptimalBet()
  }, [playerBalance, trueCount])

  const getCardColor = (card: CardValue) => {
    return ["♥", "♦"].includes(card) ? "text-red-600" : "text-black"
  }

  const getActionColor = (action: Action) => {
    switch (action) {
      case "HIT":
        return "bg-blue-600 hover:bg-blue-700"
      case "STAND":
        return "bg-green-600 hover:bg-green-700"
      case "DOUBLE":
        return "bg-yellow-600 hover:bg-yellow-700"
      case "SPLIT":
        return "bg-purple-600 hover:bg-purple-700"
      default:
        return "bg-gray-600 hover:bg-gray-700"
    }
  }

  const deckPenetration = ((deckCount * 52 - totalCardsRemaining) / (deckCount * 52)) * 100

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-green-900 via-green-800 to-emerald-900 p-4">
        <div className="max-w-7xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">🃏 Blackjack Card Counter</h1>
            <p className="text-green-200 text-lg">Professional Card Counting & Strategy Tool</p>
          </div>

          {/* Configuration Panel */}
          <Card className="bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600 shadow-2xl">
            <CardContent className="p-6">
              <div className="flex flex-wrap items-center justify-center gap-6">
                {/* Deck Count */}
                <div className="flex items-center gap-3">
                  <label className="text-white font-semibold text-lg">Decks:</label>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setDeckCount(Math.max(1, deckCount - 1))}
                      className="bg-slate-700 border-slate-500 text-white hover:bg-slate-600 h-12 w-12"
                    >
                      <Minus className="h-5 w-5" />
                    </Button>
                    <div className="bg-white rounded-lg px-4 py-3 min-w-[80px] text-center">
                      <span className="text-2xl font-bold text-slate-800">{deckCount}</span>
                    </div>
                    <Button
                      variant="outline"
                      size="lg"
                      onClick={() => setDeckCount(Math.min(8, deckCount + 1))}
                      className="bg-slate-700 border-slate-500 text-white hover:bg-slate-600 h-12 w-12"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {/* Balance */}
                <div className="flex items-center gap-3">
                  <label className="text-white font-semibold text-lg">Balance:</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-green-600" />
                    <Input
                      type="number"
                      value={playerBalance}
                      onChange={(e) => setPlayerBalance(Math.max(5, Number.parseInt(e.target.value) || 0))}
                      className="pl-10 w-32 h-12 text-lg font-semibold bg-white border-2 border-green-300 focus:border-green-500"
                      min="5"
                    />
                  </div>
                </div>

                {/* Round Counter */}
                <div className="flex items-center gap-3">
                  <Hash className="h-6 w-6 text-white" />
                  <div className="bg-white rounded-lg px-4 py-3 min-w-[100px] text-center">
                    <span className="text-lg font-bold text-slate-800">Round {currentRound}</span>
                  </div>
                </div>

                {/* Next Round Button */}
                <Button
                  onClick={nextRound}
                  size="lg"
                  className="bg-green-600 hover:bg-green-700 text-white font-semibold px-6 py-3 h-12"
                  disabled={playerCards.length === 0 && !dealerCard}
                >
                  <ArrowRight className="h-5 w-5 mr-2" />
                  Next Round
                </Button>

                {/* Reset Button */}
                <Button
                  onClick={resetGame}
                  size="lg"
                  className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-3 h-12"
                >
                  <RotateCcw className="h-5 w-5 mr-2" />
                  Reset Game
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Card Selection */}
          <Card className="bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600 shadow-2xl">
            <CardHeader>
              <CardTitle className="text-white text-center text-2xl font-bold">🎯 Card Selection</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid grid-cols-6 md:grid-cols-13 gap-3 max-w-6xl mx-auto">
                {CARD_VALUES.map((card) => (
                  <Button
                    key={card}
                    onClick={() => addCard(card)}
                    disabled={cardCounts[card] === 0}
                    className={`
                      relative h-20 w-full bg-white hover:bg-gray-100 border-2 border-gray-300 
                      disabled:bg-gray-300 disabled:text-gray-500 disabled:border-gray-400
                      transition-all duration-200 transform hover:scale-105 hover:shadow-lg
                      ${cardCounts[card] === 0 ? "opacity-50" : "shadow-md"}
                    `}
                  >
                    <div className="flex flex-col items-center justify-center h-full">
                      <span className={`text-2xl font-bold ${getCardColor(card)}`}>{card}</span>
                      <span className="text-xs font-semibold text-gray-600 mt-1">{cardCounts[card]}</span>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Player and Dealer Hands */}
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Player Cards */}
            <Card className="bg-gradient-to-br from-blue-800 to-blue-700 border-blue-600 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white text-center text-xl font-bold flex items-center justify-center gap-2">
                  <Target className="h-6 w-6" />
                  Your Hand
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                  {CARD_VALUES.map((card) => (
                    <Button
                      key={card}
                      onClick={() => addPlayerCard(card)}
                      disabled={cardCounts[card] === 0}
                      size="lg"
                      className="h-16 bg-blue-600 text-white hover:bg-blue-500 disabled:bg-gray-500 font-bold text-lg transition-all duration-200 hover:scale-105"
                    >
                      {card}
                    </Button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap gap-2">
                    {playerCards.map((card, index) => (
                      <Badge
                        key={index}
                        variant="secondary"
                        className="cursor-pointer bg-white text-blue-800 hover:bg-gray-100 px-3 py-2 text-lg font-bold transition-all duration-200 hover:scale-105"
                        onClick={() => removePlayerCard(index)}
                      >
                        {card} ×
                      </Badge>
                    ))}
                  </div>
                  {playerCards.length > 0 && (
                    <div className="bg-blue-900 rounded-lg p-4">
                      <p className="text-white text-xl font-bold text-center">
                        Hand Value: {playerHand.total} {playerHand.isSoft && "(Soft)"}
                      </p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Dealer Card */}
            <Card className="bg-gradient-to-br from-red-800 to-red-700 border-red-600 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white text-center text-xl font-bold flex items-center justify-center gap-2">
                  <Zap className="h-6 w-6" />
                  Dealer Up Card
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-4 md:grid-cols-6 gap-3">
                  {CARD_VALUES.map((card) => (
                    <Button
                      key={card}
                      onClick={() => setDealerUpCard(card)}
                      disabled={cardCounts[card] === 0}
                      size="lg"
                      className="h-16 bg-red-600 text-white hover:bg-red-500 disabled:bg-gray-500 font-bold text-lg transition-all duration-200 hover:scale-105"
                    >
                      {card}
                    </Button>
                  ))}
                </div>

                <div className="space-y-3">
                  {dealerCard && (
                    <div className="flex justify-center">
                      <Badge
                        variant="secondary"
                        className="cursor-pointer bg-white text-red-800 hover:bg-gray-100 px-4 py-3 text-xl font-bold transition-all duration-200 hover:scale-105"
                        onClick={clearDealerCard}
                      >
                        {dealerCard} ×
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Statistics Dashboard */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
            <Card className="bg-gradient-to-br from-blue-600 to-blue-700 border-blue-500 shadow-xl">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">{runningCount}</div>
                  <div className="text-blue-100 font-medium">Running Count</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-600 to-purple-700 border-purple-500 shadow-xl">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">{trueCount.toFixed(1)}</div>
                  <div className="text-purple-100 font-medium">True Count</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-orange-600 to-orange-700 border-orange-500 shadow-xl">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">{totalCardsRemaining}</div>
                  <div className="text-orange-100 font-medium">Cards Left</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-yellow-600 to-yellow-700 border-yellow-500 shadow-xl">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">{(totalCardsRemaining / 52).toFixed(1)}</div>
                  <div className="text-yellow-100 font-medium">Decks Left</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-600 to-emerald-700 border-emerald-500 shadow-xl">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-1 flex items-center justify-center">
                    <Percent className="h-6 w-6 mr-1" />
                    {(winProbability * 100).toFixed(1)}%
                  </div>
                  <div className="text-emerald-100 font-medium">Win Chance</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-600 to-amber-700 border-amber-500 shadow-xl">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-1 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 mr-1" />
                    {optimalBet}
                  </div>
                  <div className="text-amber-100 font-medium">Optimal Bet</div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-teal-600 to-teal-700 border-teal-500 shadow-xl">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-white mb-1">{deckPenetration.toFixed(1)}%</div>
                  <div className="text-teal-100 font-medium">Penetration</div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Strategy Recommendations */}
          {playerCards.length > 0 && dealerCard && (
            <div className="grid md:grid-cols-2 gap-6">
              <Card className="bg-gradient-to-br from-indigo-700 to-indigo-800 border-indigo-600 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-white text-center text-xl font-bold flex items-center justify-center gap-2">
                    📚 Basic Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <Button
                      size="lg"
                      className={`text-4xl font-bold py-8 px-12 w-full ${getActionColor(getBasicStrategyForCurrentHand())} text-white transition-all duration-200 hover:scale-105 shadow-lg`}
                    >
                      {getBasicStrategyForCurrentHand()}
                    </Button>
                    <div className="text-indigo-200 font-medium">By the Book Recommendation</div>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-pink-700 to-pink-800 border-pink-600 shadow-2xl">
                <CardHeader>
                  <CardTitle className="text-white text-center text-xl font-bold flex items-center justify-center gap-2">
                    <TrendingUp className="h-6 w-6" />
                    AI Strategy
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="text-center space-y-4">
                    <Button
                      size="lg"
                      className={`text-4xl font-bold py-8 px-12 w-full ${getActionColor(getAIRecommendation())} text-white transition-all duration-200 hover:scale-105 shadow-lg`}
                    >
                      {getAIRecommendation()}
                    </Button>
                    <div className="text-pink-200 font-medium">Count-Adjusted Strategy</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Round History */}
          {roundHistory.length > 0 && (
            <Card className="bg-gradient-to-r from-slate-800 to-slate-700 border-slate-600 shadow-2xl">
              <CardHeader>
                <CardTitle className="text-white text-center text-xl font-bold">📊 Round History</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="overflow-x-auto">
                  <div className="grid gap-3">
                    {roundHistory.slice(-5).map((round) => (
                      <div key={round.round} className="bg-slate-700 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Badge variant="secondary" className="bg-white text-slate-800 font-bold">
                            Round {round.round}
                          </Badge>
                          <span className="text-white">Player: {round.playerTotal}</span>
                          <span className="text-white">Dealer: {round.dealerCard}</span>
                          <Badge className={getActionColor(round.action)}>{round.action}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-green-300">{(round.winProbability * 100).toFixed(1)}% win</span>
                          <span className="text-yellow-300">${round.optimalBet} bet</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Add padding at bottom to prevent content from being hidden behind simulator */}
          <div className="h-20"></div>
        </div>
      </div>

      {/* Collapsible Simulator at Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <Card
            className={`bg-gradient-to-r from-purple-800 to-purple-700 border-purple-600 shadow-2xl transition-all duration-300 ease-in-out ${
              isSimulatorExpanded ? "max-h-[80vh] overflow-y-auto" : "max-h-16 overflow-hidden"
            }`}
          >
            <div className="flex items-center justify-between p-4 cursor-pointer" onClick={toggleSimulator}>
              <CardTitle className="text-white text-xl md:text-2xl font-bold flex items-center gap-2">
                <BarChart3 className="h-6 w-6" />
                Strategy Simulator
              </CardTitle>
              <Button variant="ghost" size="sm" className="text-white hover:bg-purple-600">
                {isSimulatorExpanded ? "Collapse" : "Expand"}
              </Button>
            </div>

            <CardContent
              className={`p-6 space-y-6 transition-all duration-300 ${isSimulatorExpanded ? "opacity-100" : "opacity-0"}`}
            >
              {/* Simulation Configuration */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <label className="text-white font-medium">Hands to Simulate</label>
                  <Input
                    type="number"
                    value={simulationConfig.handsToSimulate}
                    onChange={(e) =>
                      setSimulationConfig((prev) => ({
                        ...prev,
                        handsToSimulate: Number.parseInt(e.target.value) || 1000,
                      }))
                    }
                    className="bg-white"
                    min="100"
                    max="100000"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-white font-medium">Strategy</label>
                  <Select
                    value={simulationConfig.strategy}
                    onValueChange={(value: SimulationStrategy) =>
                      setSimulationConfig((prev) => ({ ...prev, strategy: value }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="basic">Basic Strategy</SelectItem>
                      <SelectItem value="ai">AI Strategy (Count-Adjusted)</SelectItem>
                      <SelectItem value="advanced">Advanced Strategy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-white font-medium">Betting Strategy</label>
                  <Select
                    value={simulationConfig.bettingStrategy}
                    onValueChange={(value: BettingStrategy) =>
                      setSimulationConfig((prev) => ({ ...prev, bettingStrategy: value }))
                    }
                  >
                    <SelectTrigger className="bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flat">Flat Betting</SelectItem>
                      <SelectItem value="kelly">Kelly Criterion</SelectItem>
                      <SelectItem value="progressive">Progressive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-white font-medium">Initial Bankroll</label>
                  <Input
                    type="number"
                    value={simulationConfig.initialBankroll}
                    onChange={(e) =>
                      setSimulationConfig((prev) => ({
                        ...prev,
                        initialBankroll: Number.parseInt(e.target.value) || 1000,
                      }))
                    }
                    className="bg-white"
                    min="100"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-white font-medium">Min Bet</label>
                  <Input
                    type="number"
                    value={simulationConfig.minBet}
                    onChange={(e) =>
                      setSimulationConfig((prev) => ({
                        ...prev,
                        minBet: Number.parseInt(e.target.value) || 5,
                      }))
                    }
                    className="bg-white"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-white font-medium">Max Bet</label>
                  <Input
                    type="number"
                    value={simulationConfig.maxBet}
                    onChange={(e) =>
                      setSimulationConfig((prev) => ({
                        ...prev,
                        maxBet: Number.parseInt(e.target.value) || 100,
                      }))
                    }
                    className="bg-white"
                    min="5"
                  />
                </div>
              </div>

              {/* Simulation Controls */}
              <div className="flex items-center justify-center gap-4">
                <Button
                  onClick={runSimulation}
                  disabled={isSimulating}
                  size="lg"
                  className="bg-purple-600 hover:bg-purple-700 text-white font-semibold px-8 py-3"
                >
                  {isSimulating ? (
                    <>
                      <Pause className="h-5 w-5 mr-2" />
                      Simulating...
                    </>
                  ) : (
                    <>
                      <Play className="h-5 w-5 mr-2" />
                      Run Simulation
                    </>
                  )}
                </Button>

                {isSimulating && (
                  <div className="flex-1 max-w-md">
                    <Progress value={simulationProgress} className="h-3" />
                    <p className="text-white text-sm mt-1 text-center">{simulationProgress.toFixed(1)}% Complete</p>
                  </div>
                )}
              </div>

              {/* Simulation Results */}
              {simulationResults && (
                <div className="space-y-4">
                  <h3 className="text-white text-xl font-bold text-center">Simulation Results</h3>

                  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <Card className="bg-green-700 border-green-600">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-white">{simulationResults.handsWon}</div>
                        <div className="text-green-200">Hands Won</div>
                        <div className="text-sm text-green-300">{(simulationResults.winRate * 100).toFixed(1)}%</div>
                      </CardContent>
                    </Card>

                    <Card className="bg-red-700 border-red-600">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-white">{simulationResults.handsLost}</div>
                        <div className="text-red-200">Hands Lost</div>
                        <div className="text-sm text-red-300">
                          {((simulationResults.handsLost / simulationResults.handsPlayed) * 100).toFixed(1)}%
                        </div>
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-700 border-blue-600">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-white">${simulationResults.netProfit.toFixed(0)}</div>
                        <div className="text-blue-200">Net Profit</div>
                        <div className="text-sm text-blue-300">{simulationResults.roi.toFixed(1)}% ROI</div>
                      </CardContent>
                    </Card>

                    <Card className="bg-yellow-700 border-yellow-600">
                      <CardContent className="p-4 text-center">
                        <div className="text-2xl font-bold text-white">
                          ${simulationResults.finalBankroll.toFixed(0)}
                        </div>
                        <div className="text-yellow-200">Final Bankroll</div>
                        <div className="text-sm text-yellow-300">
                          Max DD: ${simulationResults.maxDrawdown.toFixed(0)}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="bg-purple-900 rounded-lg p-4">
                    <h4 className="text-white font-bold mb-2">Summary Statistics</h4>
                    <div className="grid md:grid-cols-2 gap-4 text-white">
                      <div>
                        <p>Total Hands Played: {simulationResults.handsPlayed}</p>
                        <p>Total Wagered: ${simulationResults.totalWagered.toFixed(0)}</p>
                        <p>Total Won: ${simulationResults.totalWon.toFixed(0)}</p>
                      </div>
                      <div>
                        <p>Win Rate: {(simulationResults.winRate * 100).toFixed(2)}%</p>
                        <p>
                          Push Rate:{" "}
                          {((simulationResults.handsPushed / simulationResults.handsPlayed) * 100).toFixed(2)}%
                        </p>
                        <p>Return on Investment: {simulationResults.roi.toFixed(2)}%</p>
                      </div>
                    </div>
                  </div>

                  {/* Recent Hands Sample */}
                  {simulationHands.length > 0 && (
                    <div className="bg-purple-900 rounded-lg p-4">
                      <h4 className="text-white font-bold mb-2">Sample Recent Hands</h4>
                      <div className="space-y-2 max-h-40 overflow-y-auto">
                        {simulationHands.slice(-10).map((hand) => (
                          <div key={hand.handNumber} className="text-sm text-white flex justify-between items-center">
                            <span>
                              Hand #{hand.handNumber}: P:{hand.playerTotal} vs D:{hand.dealerTotal}
                            </span>
                            <span
                              className={`font-bold ${
                                hand.result === "win"
                                  ? "text-green-300"
                                  : hand.result === "loss"
                                    ? "text-red-300"
                                    : "text-yellow-300"
                              }`}
                            >
                              {hand.result.toUpperCase()} ${hand.profit > 0 ? "+" : ""}
                              {hand.profit.toFixed(0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
