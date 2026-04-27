import React, { useState, useMemo } from "react";
import { PlusCircle, Target, Globe, Image as ImageIcon, Info, CheckCircle2, Circle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTelegram } from "../contexts/TelegramContext";
import { motion } from "framer-motion";

const CATEGORIES = {
  "Social Media": ["Like", "Comment", "Direct Message", "Add Friend/Follow/Connect", "Join an Event/Group", "Post/Share", "Create a Story", "Like + Post/Share", "Add an App"],
  "Data Transcription": ["Audio to text", "Image to text"],
  "Content Translation": ["English to Spanish", "Other languages"],
  "Data Collection/Mining/Extraction/AI Training": ["Data gathering", "Image classification"],
  "SEO & Web Traffic": ["Search and click", "Website visit"],
  "Video/Music Sharing Platforms": ["Watch video", "Subscribe", "Like video"],
  "Promotion": ["Forum post", "Upvote"],
  "Mobile Applications (iPhone & Android)": ["Download & Install", "Review app"],
  "Leads": ["Sign up", "Email submit"],
  "Write an honest review (Service, Product)": ["Trustpilot", "Google Maps"],
  "Other": ["Custom task"]
};

// Simplified continents and countries for demo
const CONTINENTS = {
  "North America": ["United States", "Canada", "Mexico", "Costa Rica", "Panama", "Guatemala", "Honduras", "Nicaragua", "El Salvador"],
  "South America": ["Brazil", "Argentina", "Chile", "Colombia", "Peru", "Venezuela", "Ecuador", "Bolivia", "Uruguay", "Paraguay"],
  "Asia": ["China", "India", "Japan", "South Korea", "Vietnam", "Thailand", "Indonesia", "Malaysia", "Philippines", "Singapore", "Taiwan"],
  "Africa": ["Nigeria", "South Africa", "Egypt", "Kenya", "Morocco", "Ghana", "Ethiopia", "Tanzania", "Uganda", "Algeria"],
  "Oceania": ["Australia", "New Zealand", "Fiji", "Papua New Guinea", "Solomon Islands", "Vanuatu", "New Caledonia", "Samoa"],
  "Eastern Europe": ["Poland", "Romania", "Hungary", "Czech Republic", "Slovakia", "Bulgaria", "Croatia", "Serbia", "Ukraine", "Belarus"],
  "Western Europe": ["Germany", "France", "United Kingdom", "Italy", "Spain", "Netherlands", "Belgium", "Switzerland", "Austria", "Ireland"]
};

export function CreateTask() {
  const navigate = useNavigate();
  const { user } = useTelegram();
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [targetMode, setTargetMode] = useState<'international' | 'specific'>('international');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [expandedContinent, setExpandedContinent] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    category: "",
    subCategory: "",
    jobLength: "1",
    payRate: "0.05",
    availabilities: "",
    title: "",
    description: "",
    proofInstructions: "",
    image: null as File | null
  });

  const handleCountryToggle = (country: string) => {
    setSelectedCountries(prev => 
      prev.includes(country) ? prev.filter(c => c !== country) : [...prev, country]
    );
  };

  const handleContinentToggleAll = (continent: string) => {
    const countries = CONTINENTS[continent as keyof typeof CONTINENTS];
    const allSelected = countries.every(c => selectedCountries.includes(c));
    
    if (allSelected) {
      setSelectedCountries(prev => prev.filter(c => !countries.includes(c)));
    } else {
      setSelectedCountries(prev => {
        const next = new Set([...prev]);
        countries.forEach(c => next.add(c));
        return Array.from(next);
      });
    }
  };

  const isContinentFullySelected = (continent: string) => {
    return CONTINENTS[continent as keyof typeof CONTINENTS].every(c => selectedCountries.includes(c));
  };
  
  const isContinentPartiallySelected = (continent: string) => {
    const countries = CONTINENTS[continent as keyof typeof CONTINENTS];
    const selectedCount = countries.filter(c => selectedCountries.includes(c)).length;
    return selectedCount > 0 && selectedCount < countries.length;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, category: e.target.value, subCategory: '' }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    navigate("/campaigns");
  };

  const estimatedCost = parseFloat(formData.payRate || "0") * parseInt(formData.availabilities || "0", 10);
  const totalCost = (estimatedCost + (estimatedCost * 0.15)).toFixed(2); // Example 15% fee

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-20">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Create a new campaign</h1>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Targeting */}
        <section className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-[#0b0c10]/50">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
              <Globe className="w-5 h-5 mr-2 text-blue-500" />
              Choose countries you'll be accepting workers from:
            </h2>
          </div>
          <div className="p-6 space-y-4">
            <div 
              className="flex items-center space-x-3 cursor-pointer group"
              onClick={() => setTargetMode('international')}
            >
              <div className="relative flex items-center justify-center">
                <Circle className="w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:text-blue-400" />
                {targetMode === 'international' && <div className="absolute w-2.5 h-2.5 bg-amber-500 rounded-full" />}
              </div>
              <span className="font-medium text-gray-800 dark:text-gray-200">International (all countries)</span>
            </div>

            <div 
              className="flex items-center space-x-3 cursor-pointer group"
              onClick={() => setTargetMode('specific')}
            >
              <div className="relative flex items-center justify-center">
                <Circle className="w-5 h-5 text-gray-700 dark:text-gray-300 group-hover:text-blue-400" />
                {targetMode === 'specific' && <div className="absolute w-2.5 h-2.5 bg-amber-500 rounded-full" />}
              </div>
              <span className="font-medium text-gray-800 dark:text-gray-200">Choose by country</span>
            </div>

            {targetMode === 'specific' && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }} 
                animate={{ opacity: 1, height: 'auto' }} 
                className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-800 pl-8"
              >
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Choose by continent or individual country (select at least one):</p>
                <div className="space-y-2">
                  {Object.entries(CONTINENTS).map(([continent, countries]) => (
                    <div key={continent} className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden">
                      <div 
                        className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-[#0b0c10] cursor-pointer hover:bg-gray-800 transition-colors"
                        onClick={() => setExpandedContinent(expandedContinent === continent ? null : continent)}
                      >
                        <div className="flex items-center space-x-3">
                          <button 
                            type="button"
                            className="p-1 focus:outline-none"
                            onClick={(e) => { e.stopPropagation(); handleContinentToggleAll(continent); }}
                          >
                            <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${ isContinentFullySelected(continent) ? 'bg-amber-500 border-amber-500 text-white' : isContinentPartiallySelected(continent) ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-700 bg-[#111218]' }`}>
                              {isContinentFullySelected(continent) && <CheckCircle2 className="w-3.5 h-3.5" />}
                              {isContinentPartiallySelected(continent) && <div className="w-2.5 h-0.5 bg-white dark:bg-[#111218] rounded-full" />}
                            </div>
                          </button>
                          <span className="font-semibold text-gray-800 dark:text-gray-200">{continent}</span>
                        </div>
                        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                          {expandedContinent === continent ? 'Collapse' : 'Expand'}
                        </span>
                      </div>
                      
                      {expandedContinent === continent && (
                        <div className="px-4 py-3 bg-white dark:bg-[#111218] grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-gray-200 dark:border-gray-800">
                          {countries.map(country => (
                            <label key={country} className="flex items-center space-x-2 cursor-pointer group">
                              <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors ${ selectedCountries.includes(country) ? 'bg-amber-500 border-amber-500 text-white' : 'border-gray-700 bg-white dark:bg-[#111218] group-hover:border-blue-400' }`}>
                                {selectedCountries.includes(country) && <CheckCircle2 className="w-3 h-3" />}
                              </div>
                              <span className="text-sm text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white truncate">{country}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </section>

        {/* Section 2: Category */}
        <section className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Choose campaign category:</h2>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Category</label>
              <select 
                name="category"
                value={formData.category}
                onChange={handleCategoryChange}
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0c10] focus:bg-white dark:focus:bg-[#111218] focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium text-gray-700 dark:text-gray-300"
              >
                <option value="" disabled>Select a category</option>
                {Object.keys(CATEGORIES).map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {formData.category && (
               <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 ml-1">Sub-Category</label>
                <select 
                  name="subCategory"
                  value={formData.subCategory}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0c10] focus:bg-white dark:focus:bg-[#111218] focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium text-gray-700 dark:text-gray-300"
                >
                  <option value="" disabled>Select a sub-category</option>
                  {(CATEGORIES as any)[formData.category].map((sub: string) => (
                    <option key={sub} value={sub}>{sub}</option>
                  ))}
                </select>
              </motion.div>
            )}
          </div>
        </section>

        {/* Section 3: Details */}
        <section className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 space-y-5">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Enter campaign details:</h2>
            <div className="bg-amber-500/10/50 border border-blue-100 rounded-xl p-4 flex items-start space-x-3 text-sm text-blue-900">
              <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
              <p>The automatically populated <strong>job length</strong> and <strong>pay rate</strong> values are the minimum values for these fields. Campaigns that do not meet these minimum values will be canceled. The minimum cost of a campaign is $0.30.</p>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 border border-gray-200 dark:border-gray-800 rounded-xl p-4 bg-[#0b0c10]/30">
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Job Length (minutes)</label>
                <input 
                  type="number" name="jobLength" value={formData.jobLength} onChange={handleChange} min="1" required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-amber-500 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Pay Rate (USD)</label>
                <input 
                  type="number" name="payRate" value={formData.payRate} onChange={handleChange} min="0.01" step="0.01" required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-amber-500 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1.5">Total Availabilities</label>
                <input 
                  type="number" name="availabilities" value={formData.availabilities} onChange={handleChange} min="1" placeholder="e.g. 50" required
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 focus:outline-none focus:border-amber-500 text-sm font-medium"
                />
              </div>
            </div>
            
            <div className="flex justify-start">
               <span className="font-semibold text-gray-700 dark:text-gray-300">Estimated cost: ${isNaN(estimatedCost) ? "0.00" : estimatedCost.toFixed(2)}</span>
            </div>
          </div>
        </section>

        {/* Section 4: Title and Description */}
        <section className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Enter campaign title and description:</h2>
            <div>
               <input 
                  type="text" name="title" value={formData.title} onChange={handleChange} required
                  placeholder="Campaign Title (Must be written in English) *"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#0b0c10] focus:bg-white dark:focus:bg-[#111218] focus:outline-none focus:border-amber-500 font-medium text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
               />
            </div>
            <div>
               <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 mt-2">
                 Campaign Description (Must be written in English and the use of text formatting is encouraged)
               </label>
               <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500">
                  <div className="bg-gray-50 dark:bg-[#0b0c10] border-b border-gray-200 dark:border-gray-800 p-2 flex items-center space-x-1 overflow-x-auto">
                    {/* Simulated formatting toolbar */}
                    <button type="button" className="p-1.5 hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 font-serif font-bold w-8 text-center">B</button>
                    <button type="button" className="p-1.5 hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 font-serif italic w-8 text-center">I</button>
                    <button type="button" className="p-1.5 hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 font-serif underline w-8 text-center">U</button>
                    <div className="w-px h-5 bg-gray-300 mx-1"></div>
                    <button type="button" className="px-2 py-1.5 hover:bg-gray-700 rounded text-gray-500 dark:text-gray-400 text-xs font-semibold">Normal ▾</button>
                  </div>
                  <textarea 
                    name="description" value={formData.description} onChange={handleChange} required rows={6}
                    placeholder="1. Enter detailed step-by-step instructions (Must be written in English)&#10;2. Add any relevant links or resources&#10;3. Use formatting tools above to make your description clear and organized"
                    className="w-full p-4 border-none bg-white dark:bg-[#111218] text-gray-900 dark:text-white focus:outline-none text-sm resize-none"
                  />
               </div>
            </div>
          </div>
        </section>

        {/* Section 5: Image Upload */}
        <section className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Upload related image (optional):</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">You can upload an image to help workers understand the campaign instructions.</p>
            
            <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-gray-50 dark:hover:bg-[#0b0c10] transition-colors cursor-pointer">
              <ImageIcon className="w-10 h-10 text-gray-500 mb-3" />
              <button type="button" className="px-4 py-2 bg-gray-50 dark:bg-[#0b0c10] border border-gray-200 dark:border-gray-800 rounded-lg text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 hover:bg-white dark:hover:bg-[#111218]">
                Drop or Select file
              </button>
              <p className="text-xs text-gray-500">Allowed formats: JPG, PNG, WEBP (max 1MB)</p>
            </div>
          </div>
        </section>

        {/* Section 6: Required Proof */}
        <section className="bg-white dark:bg-[#111218] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Enter required proof of finished job:</h2>
            <div>
               <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1 ml-1">Proof Required *</label>
               <textarea 
                 name="proofInstructions" value={formData.proofInstructions} onChange={handleChange} required rows={5}
                 placeholder="1. Instructions for proof submission (Must be written in English)&#10;2. Screenshot of completed task&#10;3. URL or link to the completed work"
                 className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-800 focus:bg-white dark:focus:bg-[#111218] focus:outline-none focus:border-amber-500 font-medium text-gray-900 dark:text-white text-sm resize-none"
               />
            </div>
          </div>
        </section>

        <div className="flex flex-col items-center pt-2">
          <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 mb-4">The campaign approval fee is 15% of the total campaign cost</p>
          <button 
            type="submit" 
            disabled={isSubmitting || !formData.availabilities || isNaN(totalCost as any)}
            className="w-full sm:w-auto px-12 py-4 bg-amber-500 hover:bg-amber-600 text-amber-950 text-center rounded-xl font-bold transition-colors disabled:opacity-70 flex items-center justify-center active:scale-95"
          >
            {isSubmitting ? (
              <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            ) : (
              `Submit Campaign ($${isNaN(totalCost as any) ? "0.00" : totalCost})`
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

