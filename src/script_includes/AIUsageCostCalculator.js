var AIUsageCostCalculator = Class.create();
AIUsageCostCalculator.prototype = {
    
    initialize: function() {
        this.LOG_PREFIX = 'AIUsageCostCalculator';
        
        // Azure OpenAI Pricing (Update as needed - as of Jan 2025)
        this.PRICING = {
            'gpt-4': {
                input: 0.03,    // $0.03 per 1K tokens
                output: 0.06    // $0.06 per 1K tokens
            },
            'gpt-4-turbo': {
                input: 0.01,
                output: 0.03
            },
            'gpt-3.5-turbo': {
                input: 0.0005,
                output: 0.0015
            }
        };
        
        this.DEFAULT_MODEL = gs.getProperty('azure.openai.deployment.name', 'gpt-4');
    },
    
    /**
     * Calculate cost for a single API call
     * @param {Number} inputTokens - Number of input tokens
     * @param {Number} outputTokens - Number of output tokens
     * @param {String} model - Model name
     * @returns {Object} - Cost breakdown
     */
    calculateCost: function(inputTokens, outputTokens, model) {
        model = model || this.DEFAULT_MODEL;
        
        var pricing = this.PRICING[model];
        if (!pricing) {
            gs.warn(this.LOG_PREFIX + ': Unknown model ' + model + ', using gpt-4 pricing');
            pricing = this.PRICING['gpt-4'];
        }
        
        var inputCost = (inputTokens / 1000) * pricing.input;
        var outputCost = (outputTokens / 1000) * pricing.output;
        var totalCost = inputCost + outputCost;
        
        return {
            inputTokens: inputTokens,
            outputTokens: outputTokens,
            totalTokens: inputTokens + outputTokens,
            inputCost: this._round(inputCost, 4),
            outputCost: this._round(outputCost, 4),
            totalCost: this._round(totalCost, 4),
            model: model,
            currency: 'USD'
        };
    },
    
    /**
     * Get cost summary for a date range
     * @param {GlideDateTime} startDate - Start date
     * @param {GlideDateTime} endDate - End date
     * @returns {Object} - Cost summary
     */
    getCostSummary: function(startDate, endDate) {
        var logGr = new GlideRecord('u_ai_test_generation_log');
        
        if (startDate) {
            logGr.addQuery('u_generated_at', '>=', startDate);
        }
        if (endDate) {
            logGr.addQuery('u_generated_at', '<=', endDate);
        }
        
        logGr.query();
        
        var totalCost = 0;
        var totalTokens = 0;
        var totalGenerations = 0;
        var successfulGenerations = 0;
        
        while (logGr.next()) {
            totalGenerations++;
            
            if (logGr.getValue('u_success') == 'true') {
                successfulGenerations++;
            }
            
            var cost = parseFloat(logGr.getValue('u_estimated_cost') || 0);
            var tokens = parseInt(logGr.getValue('u_total_tokens') || 0);
            
            totalCost += cost;
            totalTokens += tokens;
        }
        
        return {
            totalGenerations: totalGenerations,
            successfulGenerations: successfulGenerations,
            failedGenerations: totalGenerations - successfulGenerations,
            totalCost: this._round(totalCost, 2),
            totalTokens: totalTokens,
            averageCostPerGeneration: totalGenerations > 0 ? 
                this._round(totalCost / totalGenerations, 4) : 0,
            averageTokensPerGeneration: totalGenerations > 0 ? 
                Math.round(totalTokens / totalGenerations) : 0,
            currency: 'USD'
        };
    },
    
    /**
     * Round number to specified decimal places
     */
    _round: function(value, decimals) {
        var multiplier = Math.pow(10, decimals);
        return Math.round(value * multiplier) / multiplier;
    },
    
    type: 'AIUsageCostCalculator'
};