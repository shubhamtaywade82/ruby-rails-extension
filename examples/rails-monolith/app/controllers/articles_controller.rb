class ArticlesController < ApplicationController
  before_action :set_article, only: [:show, :edit, :update, :destroy, :publish]

  def index
    @articles = Article.recent.includes(:user)
  end

  def show
  end

  def new
    @article = Article.new
  end

  def create
    @article = current_user.articles.build(article_params)
    if @article.save
      redirect_to @article, notice: "Article was successfully created."
    else
      render :new, status: :unprocessable_entity
    end
  end

  def publish
    ArticlePublisher.new(@article).call
    redirect_to @article, notice: "Article published!"
  end

  private

  def set_article
    @article = Article.find(params[:id])
  end

  def article_params
    params.require(:article).permit(:title, :body, :status)
  end

  def current_user
    @current_user ||= User.first
  end
end
