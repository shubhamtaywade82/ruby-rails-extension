class ArticleCardComponent < ViewComponent::Base
  def initialize(article:)
    @article = article
  end

  def render?
    @article.present?
  end
end
