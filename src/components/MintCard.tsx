interface MintCardProps {
  name: string;
  price: string;
  totalValue: string;
  icon?: React.ReactNode;
  bgColor?: string;
}

export default function MintCard({
  name,
  price,
  totalValue,
  icon = "🖼️",
  bgColor = "bg-blue-100"
}: MintCardProps) {
  return (
    <div className="zuno-card p-3 sm:p-4 hover:shadow-xl transition-shadow mobile-card">
      {/* Icon Container */}
      <div className={`w-full h-24 sm:h-28 md:h-32 ${bgColor} rounded-lg sm:rounded-xl mb-3 sm:mb-4 flex items-center justify-center relative overflow-hidden`}>
        <div className="text-3xl sm:text-4xl">{icon}</div>
        {/* Decorative sparkles */}
        <div className="absolute top-2 right-2 w-2 sm:w-3 h-2 sm:h-3 bg-yellow-300 rounded-full opacity-70"></div>
        <div className="absolute bottom-3 left-3 w-1.5 sm:w-2 h-1.5 sm:h-2 bg-yellow-300 rounded-full opacity-70"></div>
      </div>
      
      {/* Project Info */}
      <div className="space-y-2 sm:space-y-3">
        <h3 className="text-base sm:text-lg font-bold text-gray-900 truncate">{name}</h3>
        
        <div className="flex items-center">
          <span className="text-gray-500 text-xs sm:text-sm">{price} / MIN</span>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 overflow-hidden">
          <div
            className="bg-green-400 h-1.5 sm:h-2 rounded-full"
            style={{ width: '60%' }}
          ></div>
        </div>
        
        <div className="text-gray-900 font-bold text-sm sm:text-base">
          {totalValue}
        </div>
      </div>
    </div>
  )
}
