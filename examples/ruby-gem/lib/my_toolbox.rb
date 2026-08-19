require_relative "my_toolbox/version"
require_relative "my_toolbox/string_utils"
require_relative "my_toolbox/hash_utils"

module MyToolbox
  class Error < StandardError; end

  def self.greet(name)
    "Hello, #{name}!"
  end
end
