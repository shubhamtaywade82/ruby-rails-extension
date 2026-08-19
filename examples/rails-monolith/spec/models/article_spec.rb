require 'rails_helper'

RSpec.describe Article, type: :model do
  let(:user) { User.create!(email: "test@example.com", name: "Tester") }

  it "validates presence of title" do
    article = Article.new(body: "Content", user: user)
    expect(article).not_to be_valid
  end

  it "publishes an article correctly" do
    article = Article.create!(title: "Hello World", body: "Sample body", user: user)
    article.publish!
    expect(article.status).to eq("published")
    expect(article.published_at).not_to be_nil
  end
end
