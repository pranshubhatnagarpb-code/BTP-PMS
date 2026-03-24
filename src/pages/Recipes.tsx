import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChefHat, Clock, Users, Flame, Search, Loader2, Lightbulb, UtensilsCrossed, Download } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

interface Recipe {
  dishName: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: string;
  difficulty: string;
  calories: string;
  ingredients: { item: string; quantity: string }[];
  instructions: string[];
  tips: string[];
  nutritionInfo: {
    protein: string;
    carbs: string;
    fat: string;
    fiber: string;
  };
}

const Recipes = () => {
  const [dishName, setDishName] = useState("");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerateRecipe = async () => {
    if (!dishName.trim()) {
      toast.error("Please enter a dish name");
      return;
    }

    setIsLoading(true);
    setRecipe(null);

    try {
      const { data, error } = await supabase.functions.invoke("generate-recipe", {
        body: { dishName: dishName.trim() },
      });

      if (error) throw error;

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setRecipe(data.recipe);
      toast.success("Recipe generated successfully!");
    } catch (err: any) {
      console.error("Error:", err);
      toast.error(err.message || "Failed to generate recipe");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!recipe) return;
    
    try {
      toast.loading("Generating PDF...");
      
      // Create a temporary div to render the recipe content
      const element = document.getElementById('recipe-content');
      if (!element) {
        toast.error("Recipe content not found");
        return;
      }
      
      // Generate canvas from the element
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      
      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgWidth = 210; // A4 width in mm
      const pageHeight = 297; // A4 height in mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      
      let position = 0;
      
      // Add first page
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
      
      // Add additional pages if needed
      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }
      
      // Save the PDF
      const fileName = `${recipe.dishName.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_recipe.pdf`;
      pdf.save(fileName);
      
      toast.success("PDF downloaded successfully!");
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Failed to generate PDF");
    }
  };

  const difficultyColor = (d: string) => {
    if (d?.toLowerCase() === "easy") return "bg-green-100 text-green-800 border-green-200";
    if (d?.toLowerCase() === "medium") return "bg-yellow-100 text-yellow-800 border-yellow-200";
    return "bg-red-100 text-red-800 border-red-200";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <ChefHat className="h-7 w-7 text-primary" />
            AI Recipe Generator
          </h1>
          <p className="text-muted-foreground mt-1">
            Enter any dish name and get a complete recipe with ingredients, steps & nutrition info
          </p>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="e.g. Paneer Butter Masala, Chicken Biryani, Masala Dosa..."
                  value={dishName}
                  onChange={(e) => setDishName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !isLoading && handleGenerateRecipe()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleGenerateRecipe} disabled={isLoading} className="min-w-[140px]">
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <UtensilsCrossed className="h-4 w-4 mr-2" />
                    Get Recipe
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Cooking up the recipe for "{dishName}"...</p>
              <p className="text-sm text-muted-foreground mt-1">This usually takes 5-10 seconds</p>
            </CardContent>
          </Card>
        )}

        {/* Recipe Result */}
        {recipe && !isLoading && (
          <div className="space-y-4">
            {/* Download Button */}
            <div className="flex justify-end">
              <Button onClick={handleDownloadPDF} className="flex items-center gap-2">
                <Download className="h-4 w-4" />
                Download PDF
              </Button>
            </div>
            
            {/* Recipe Content */}
            <div id="recipe-content" className="space-y-4">
            {/* Title & Meta */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <CardTitle className="text-xl">{recipe.dishName}</CardTitle>
                    <p className="text-muted-foreground mt-1">{recipe.description}</p>
                  </div>
                  <Badge variant="outline" className={difficultyColor(recipe.difficulty)}>
                    {recipe.difficulty}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Prep: {recipe.prepTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>Cook: {recipe.cookTime}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{recipe.servings}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Flame className="h-4 w-4" />
                    <span>{recipe.calories}</span>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Ingredients */}
              <Card className="lg:col-span-1">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">🧾 Ingredients</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {recipe.ingredients?.map((ing, i) => (
                      <li key={i} className="flex justify-between text-sm border-b border-border pb-2 last:border-0">
                        <span className="text-foreground">{ing.item}</span>
                        <span className="text-muted-foreground font-medium whitespace-nowrap ml-2">{ing.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Instructions */}
              <Card className="lg:col-span-2">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">👨‍🍳 Instructions</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3">
                    {recipe.instructions?.map((step, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-foreground">{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            </div>

            {/* Nutrition & Tips */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Nutrition */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">📊 Nutrition (per serving)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "Protein", value: recipe.nutritionInfo?.protein, color: "bg-blue-50 text-blue-700" },
                      { label: "Carbs", value: recipe.nutritionInfo?.carbs, color: "bg-amber-50 text-amber-700" },
                      { label: "Fat", value: recipe.nutritionInfo?.fat, color: "bg-rose-50 text-rose-700" },
                      { label: "Fiber", value: recipe.nutritionInfo?.fiber, color: "bg-green-50 text-green-700" },
                    ].map((n) => (
                      <div key={n.label} className={`rounded-lg p-3 ${n.color}`}>
                        <p className="text-xs font-medium opacity-70">{n.label}</p>
                        <p className="text-lg font-bold">{n.value}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tips */}
              {recipe.tips && recipe.tips.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Lightbulb className="h-4 w-4 text-warning" />
                      Pro Tips
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recipe.tips.map((tip, i) => (
                        <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                          <span className="text-primary font-bold">•</span>
                          <span>{tip}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!recipe && !isLoading && (
          <Card>
            <CardContent className="py-16 text-center">
              <ChefHat className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
              <p className="text-muted-foreground font-medium">Enter a dish name above to get started</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try "Dal Makhani", "Chole Bhature", or any dish you'd like!
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Recipes;
