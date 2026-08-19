require "my_toolbox"

RSpec.describe MyToolbox do
  it "has a version number" do
    expect(MyToolbox::VERSION).to eq("0.1.0")
  end

  it "slugifies strings" do
    expect(MyToolbox::StringUtils.slugify("Hello World!")).to eq("hello-world")
  end
end
