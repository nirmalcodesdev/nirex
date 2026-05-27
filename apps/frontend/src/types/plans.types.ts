export type PlanName = 'Free' | 'Go' | 'Pro' | 'Plus' | 'Max' | 'Enterprise' | 'Starter' | 'Team';

export interface PricingPlan {
    name: PlanName;
    price: string;
    period: string;
    description: string;
    trialDays?: number;
    features: string[];
    cta: string;
    highlight: boolean;
}

// The full array type
export type PricingPlans = PricingPlan[];
