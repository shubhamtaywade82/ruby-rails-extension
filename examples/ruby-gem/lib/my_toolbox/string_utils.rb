module MyToolbox
  module StringUtils
    def self.slugify(text)
      text.to_s.downcase.strip.gsub(/[^a-z0-9]+/, '-').gsub(/^-|-$/, '')
    end

    def self.camelize(snake_str)
      snake_str.to_s.split('_').map(&:capitalize).join
    end
  end
end
