export type PlanName = 'Starter' | 'Pro' | 'Team';

export interface PricingPlan {
    name: PlanName;
    price: string;
    period: string;
    description: string;
    features: string[];
    cta: string;
    highlight: boolean;
}

// The full array type
export type PricingPlans = PricingPlan[];