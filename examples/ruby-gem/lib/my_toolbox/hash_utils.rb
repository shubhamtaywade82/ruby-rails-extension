module MyToolbox
  module HashUtils
    def self.deep_symbolize(hash)
      hash.each_with_object({}) do |(k, v), result|
        result[k.to_sym] = v.is_a?(Hash) ? deep_symbolize(v) : v
      end
    end
  end
end
